from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1 import chats as chats_api
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import engine, get_db
from app.main import app
from app.models.chat import Chat
from app.models.message import Message
from app.models.user import User
from app.services.rag_service import ProviderError


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "test-secret-key-with-at-least-thirty-two-bytes")
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    users = [User(email=f"history-{uuid4()}@example.com", password_hash="unused") for _ in range(2)]
    db.add_all(users)
    db.commit()
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    headers = [{"Authorization": f"Bearer {create_access_token(str(user.id))}"} for user in users]
    try:
        yield client, db, users, headers
    finally:
        client.close()
        app.dependency_overrides.clear()
        db.close()
        transaction.rollback()
        connection.close()


def create_chat(client, headers, title="Research"):
    response = client.post("/api/v1/chats", headers=headers, json={"title": title})
    assert response.status_code == 201
    return response.json()


def test_create_list_and_get_own_chat(context):
    client, _, _, headers = context
    chat = create_chat(client, headers[0])
    listing = client.get("/api/v1/chats", headers=headers[0])
    detail = client.get(f"/api/v1/chats/{chat['id']}", headers=headers[0])
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == chat["id"]
    assert detail.status_code == 200
    assert detail.json()["messages"] == []


def test_cross_user_chat_access_is_blocked(context):
    client, _, _, headers = context
    chat = create_chat(client, headers[1])
    assert client.get(f"/api/v1/chats/{chat['id']}", headers=headers[0]).status_code == 404
    assert client.post(f"/api/v1/chats/{chat['id']}/messages", headers=headers[0], json={"question": "Hi"}).status_code == 404
    assert client.delete(f"/api/v1/chats/{chat['id']}", headers=headers[0]).status_code == 404


def test_post_message_persists_user_and_assistant_with_citations(context, monkeypatch):
    client, db, _, headers = context
    chat = create_chat(client, headers[0])
    citation = {"chunk_id": str(uuid4()), "document_id": str(uuid4()), "filename": "source.txt", "page_number": None, "relevance_score": 0.8}
    monkeypatch.setattr(chats_api, "answer_question", lambda *args, **kwargs: {"answer": "Answer", "sources": [citation]})
    response = client.post(f"/api/v1/chats/{chat['id']}/messages", headers=headers[0], json={"question": "Question"})
    assert response.status_code == 201
    assert [response.json()[key]["role"] for key in ("user_message", "assistant_message")] == ["user", "assistant"]
    detail = client.get(f"/api/v1/chats/{chat['id']}", headers=headers[0]).json()
    assert [message["content"] for message in detail["messages"]] == ["Question", "Answer"]
    assert detail["messages"][1]["citations"] == [citation]
    assert db.scalar(select(func.count()).select_from(Message).where(Message.chat_id == UUID(chat["id"]))) == 2


def test_provider_failure_rolls_back_both_messages(context, monkeypatch):
    client, db, _, headers = context
    chat = create_chat(client, headers[0])
    monkeypatch.setattr(chats_api, "answer_question", lambda *args, **kwargs: (_ for _ in ()).throw(ProviderError("down")))
    response = client.post(f"/api/v1/chats/{chat['id']}/messages", headers=headers[0], json={"question": "Question"})
    assert response.status_code == 503
    assert db.scalar(select(func.count()).select_from(Message).where(Message.chat_id == UUID(chat["id"]))) == 0


def test_delete_chat_removes_messages(context, monkeypatch):
    client, db, _, headers = context
    chat = create_chat(client, headers[0])
    monkeypatch.setattr(chats_api, "answer_question", lambda *args, **kwargs: {"answer": "Answer", "sources": []})
    client.post(f"/api/v1/chats/{chat['id']}/messages", headers=headers[0], json={"question": "Question"})
    response = client.delete(f"/api/v1/chats/{chat['id']}", headers=headers[0])
    assert response.status_code == 204
    assert db.get(Chat, UUID(chat["id"])) is None
    assert db.scalar(select(func.count()).select_from(Message).where(Message.chat_id == UUID(chat["id"]))) == 0
