from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.v1 import chat as chat_api
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import engine, get_db
from app.main import app
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.services import rag_service, retrieval_service
from app.services.rag_service import ProviderError


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "test-secret-key-with-at-least-thirty-two-bytes")
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    users = [User(email=f"chat-{uuid4()}@example.com", password_hash="unused") for _ in range(2)]
    db.add_all(users)
    db.commit()
    documents = [
        Document(user_id=users[0].id, filename="owned.txt", content_type="text/plain", status="ready"),
        Document(user_id=users[1].id, filename="other.txt", content_type="text/plain", status="ready"),
    ]
    db.add_all(documents)
    db.commit()
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    headers = [{"Authorization": f"Bearer {create_access_token(str(user.id))}"} for user in users]
    try:
        yield client, db, users, documents, headers
    finally:
        client.close()
        app.dependency_overrides.clear()
        db.close()
        transaction.rollback()
        connection.close()


def success_result(document):
    return {
        "answer": "Grounded answer",
        "sources": [{
            "chunk_id": uuid4(),
            "document_id": document.id,
            "filename": document.filename,
            "page_number": None,
            "relevance_score": 0.91,
        }],
    }


def test_authenticated_query_returns_structured_citations_and_forwards_filter(context, monkeypatch):
    client, _, users, documents, headers = context
    captured = {}

    def fake_answer(db, **kwargs):
        captured.update(kwargs)
        return success_result(documents[0])

    monkeypatch.setattr(chat_api, "answer_question", fake_answer)
    response = client.post(
        "/api/v1/chat/query",
        headers=headers[0],
        json={"question": "  What is this?  ", "document_ids": [str(documents[0].id)], "top_k": 3},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "Grounded answer"
    assert response.json()["citations"][0] == {
        "chunk_id": str(response.json()["citations"][0]["chunk_id"]),
        "document_id": str(documents[0].id),
        "filename": "owned.txt",
        "page_number": None,
        "relevance_score": 0.91,
    }
    assert captured == {
        "user_id": users[0].id,
        "question": "What is this?",
        "top_k": 3,
        "document_ids": [documents[0].id],
    }


def test_query_requires_authentication(context):
    client, _, _, _, _ = context
    assert client.post("/api/v1/chat/query", json={"question": "Hello"}).status_code == 401


@pytest.mark.parametrize("top_k", [0, 11])
def test_top_k_validation(context, top_k):
    client, _, _, _, headers = context
    response = client.post("/api/v1/chat/query", headers=headers[0], json={"question": "Hello", "top_k": top_k})
    assert response.status_code == 422


def test_invalid_and_cross_user_document_ids_are_rejected_before_provider(context, monkeypatch):
    client, _, _, documents, headers = context
    called = False

    def fake_answer(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(chat_api, "answer_question", fake_answer)
    invalid = client.post(
        "/api/v1/chat/query",
        headers=headers[0],
        json={"question": "Hello", "document_ids": ["not-a-uuid"]},
    )
    cross_user = client.post(
        "/api/v1/chat/query",
        headers=headers[0],
        json={"question": "Hello", "document_ids": [str(documents[1].id)]},
    )
    assert invalid.status_code == 422
    assert cross_user.status_code == 404
    assert called is False


def test_provider_failure_returns_clean_503(context, monkeypatch):
    client, _, _, _, headers = context

    def fail_provider(*args, **kwargs):
        raise ProviderError("private provider detail")

    monkeypatch.setattr(chat_api, "answer_question", fail_provider)
    response = client.post("/api/v1/chat/query", headers=headers[0], json={"question": "Hello"})
    assert response.status_code == 503
    assert response.json() == {"detail": "The language model provider is currently unavailable"}
    assert "private" not in response.text


def test_retrieval_filters_by_user_and_document_ids(context, monkeypatch):
    _, db, users, documents, _ = context
    chunks = [
        DocumentChunk(document_id=documents[0].id, chunk_index=0, content="owned", embedding=[1.0] + [0.0] * 383),
        DocumentChunk(document_id=documents[1].id, chunk_index=0, content="other", embedding=[1.0] + [0.0] * 383),
    ]
    db.add_all(chunks)
    db.commit()
    monkeypatch.setattr(retrieval_service, "embed_query", lambda query: [1.0] + [0.0] * 383)

    result = retrieval_service.search_user_documents(
        db,
        user_id=users[0].id,
        query="owned",
        top_k=5,
        document_ids=[documents[0].id],
    )

    assert [item["document_id"] for item in result] == [str(documents[0].id)]


def test_no_context_returns_grounded_fallback_without_provider_call(context, monkeypatch):
    _, db, users, _, _ = context
    monkeypatch.setattr(rag_service, "search_user_documents", lambda *args, **kwargs: [])

    class ProviderMustNotBeCreated:
        def __init__(self, *args, **kwargs):
            raise AssertionError("provider must not be called")

    monkeypatch.setattr(rag_service, "OpenAI", ProviderMustNotBeCreated)
    result = rag_service.answer_question(db, user_id=users[0].id, question="Unknown")
    assert result == {
        "answer": "I could not find relevant information in your uploaded documents.",
        "sources": [],
    }


def test_missing_provider_configuration_raises_provider_error_after_retrieval(context, monkeypatch):
    _, db, users, documents, _ = context
    monkeypatch.setattr(rag_service, "search_user_documents", lambda *args, **kwargs: [{
        "chunk_id": str(uuid4()),
        "document_id": str(documents[0].id),
        "filename": documents[0].filename,
        "page_number": None,
        "content": "Relevant context",
        "relevance_score": 1.0,
    }])
    monkeypatch.setattr(settings, "openrouter_api_key", None)

    with pytest.raises(ProviderError):
        rag_service.answer_question(db, user_id=users[0].id, question="Known")
