from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import engine, get_db
from app.main import app
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.services import ingestion_service, storage


UPLOAD_URL = "/api/v1/documents/upload"
TXT_FILE = ("notes.txt", b"A sufficiently long document with useful text for a chunk and retrieval.", "text/plain")


@pytest.fixture
def context(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "jwt_secret_key", "test-secret-key-with-at-least-thirty-two-bytes")
    monkeypatch.setattr(storage, "UPLOAD_ROOT", tmp_path)
    monkeypatch.setattr(ingestion_service, "embed_texts", lambda texts: [[0.1] * 384 for _ in texts])
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    users = [User(email=f"test-{uuid4()}@example.com", password_hash="unused") for _ in range(2)]
    db.add_all(users)
    db.commit()
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    headers = [{"Authorization": f"Bearer {create_access_token(str(user.id))}"} for user in users]
    try:
        yield client, db, users, headers, tmp_path
    finally:
        client.close()
        app.dependency_overrides.clear()
        db.close()
        transaction.rollback()
        connection.close()


def upload_txt(client, headers):
    response = client.post(UPLOAD_URL, headers=headers, files={"file": TXT_FILE})
    assert response.status_code == 201, response.text
    return response.json()


def test_authenticated_txt_upload_reaches_ready_and_creates_384_dimension_chunk(context):
    client, db, _, headers, _ = context
    data = upload_txt(client, headers[0])

    assert data["status"] == "ready"
    chunks = db.scalars(select(DocumentChunk).where(DocumentChunk.document_id == data["id"])).all()
    assert len(chunks) >= 1
    assert all(len(chunk.embedding) == 384 for chunk in chunks)


def test_upload_without_authentication_returns_401(context):
    client, _, _, _, _ = context
    assert client.post(UPLOAD_URL, files={"file": TXT_FILE}).status_code == 401


def test_unsupported_file_type_is_rejected(context):
    client, _, _, headers, _ = context
    response = client.post(UPLOAD_URL, headers=headers[0], files={"file": ("bad.csv", b"bad", "text/csv")})
    assert response.status_code == 415


def test_user_can_list_and_get_own_document_without_storage_key(context):
    client, _, _, headers, _ = context
    document = upload_txt(client, headers[0])

    list_response = client.get("/api/v1/documents?limit=1&offset=0", headers=headers[0])
    detail_response = client.get(f"/api/v1/documents/{document['id']}", headers=headers[0])

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert [item["id"] for item in list_response.json()["items"]] == [document["id"]]
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == document["id"]
    assert "storage_key" not in document
    assert "storage_key" not in list_response.json()["items"][0]
    assert "storage_key" not in detail_response.json()


def test_user_cannot_retrieve_or_delete_another_users_document(context):
    client, db, _, headers, _ = context
    document = upload_txt(client, headers[1])

    get_response = client.get(f"/api/v1/documents/{document['id']}", headers=headers[0])
    delete_response = client.delete(f"/api/v1/documents/{document['id']}", headers=headers[0])

    assert get_response.status_code == 404
    assert delete_response.status_code == 404
    assert db.get(Document, UUID(document["id"])) is not None


def test_delete_owned_document_removes_document_chunks_and_file(context):
    client, db, _, headers, upload_root = context
    document = upload_txt(client, headers[0])
    document_id = UUID(document["id"])
    assert list(upload_root.iterdir())

    response = client.delete(f"/api/v1/documents/{document['id']}", headers=headers[0])

    assert response.status_code == 204
    assert db.scalar(select(func.count()).select_from(Document).where(Document.id == document_id)) == 0
    assert db.scalar(select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document_id)) == 0
    assert not list(upload_root.iterdir())


def test_missing_physical_file_does_not_prevent_database_deletion(context):
    client, db, _, headers, _ = context
    document_data = upload_txt(client, headers[0])
    document_id = UUID(document_data["id"])
    document = db.get(Document, document_id)
    Path(document.storage_key).unlink()

    response = client.delete(f"/api/v1/documents/{document_data['id']}", headers=headers[0])

    assert response.status_code == 204
    assert db.get(Document, document_id) is None
    assert db.scalar(select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document_id)) == 0


def test_ingestion_failure_marks_document_failed_without_partial_chunks(context, monkeypatch):
    client, db, users, headers, _ = context

    def fail_embedding(texts):
        raise RuntimeError("embedding unavailable")

    monkeypatch.setattr(ingestion_service, "embed_texts", fail_embedding)
    response = client.post(UPLOAD_URL, headers=headers[0], files={"file": TXT_FILE})

    assert response.status_code == 422
    documents = db.scalars(select(Document).where(Document.user_id == users[0].id)).all()
    assert len(documents) == 1
    assert documents[0].status == "failed"
    assert db.scalar(select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == documents[0].id)) == 0
