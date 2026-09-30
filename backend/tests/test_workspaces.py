from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import engine, get_db
from app.main import app
from app.models.document import Document
from app.models.user import User


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "test-secret-key-with-at-least-thirty-two-bytes")
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    users = [User(email=f"workspace-{uuid4()}@example.com", password_hash="unused") for _ in range(2)]
    db.add_all(users)
    db.commit()
    documents = [Document(user_id=user.id, filename=f"{index}.txt", content_type="text/plain", status="ready") for index, user in enumerate(users)]
    db.add_all(documents)
    db.commit()
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    headers = [{"Authorization": f"Bearer {create_access_token(str(user.id))}"} for user in users]
    try:
        yield client, db, documents, headers
    finally:
        client.close()
        app.dependency_overrides.clear()
        db.close()
        transaction.rollback()
        connection.close()


def create_workspace(client, headers, name="Project"):
    response = client.post("/api/v1/workspaces", headers=headers, json={"name": name, "description": "Notes"})
    assert response.status_code == 201, response.text
    return response.json()


def test_workspace_crud_and_ownership(context):
    client, _, _, headers = context
    workspace = create_workspace(client, headers[0])
    assert client.get("/api/v1/workspaces", headers=headers[0]).json()["total"] == 1
    assert client.get(f"/api/v1/workspaces/{workspace['id']}", headers=headers[0]).status_code == 200
    updated = client.patch(f"/api/v1/workspaces/{workspace['id']}", headers=headers[0], json={"name": "Updated"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated"
    assert client.get(f"/api/v1/workspaces/{workspace['id']}", headers=headers[1]).status_code == 404
    assert client.delete(f"/api/v1/workspaces/{workspace['id']}", headers=headers[1]).status_code == 404


def test_assign_document_and_reject_cross_user_workspace(context):
    client, db, documents, headers = context
    own = create_workspace(client, headers[0])
    other = create_workspace(client, headers[1], "Other")
    assigned = client.patch(f"/api/v1/documents/{documents[0].id}/workspace", headers=headers[0], json={"workspace_id": own["id"]})
    assert assigned.status_code == 200
    assert assigned.json()["workspace_id"] == own["id"]
    rejected = client.patch(f"/api/v1/documents/{documents[0].id}/workspace", headers=headers[0], json={"workspace_id": other["id"]})
    assert rejected.status_code == 404
    assert client.patch(f"/api/v1/documents/{documents[1].id}/workspace", headers=headers[0], json={"workspace_id": own["id"]}).status_code == 404
    db.refresh(documents[0])
    assert documents[0].workspace_id == UUID(own["id"])


def test_delete_workspace_preserves_document(context):
    client, db, documents, headers = context
    workspace = create_workspace(client, headers[0])
    client.patch(f"/api/v1/documents/{documents[0].id}/workspace", headers=headers[0], json={"workspace_id": workspace["id"]})
    assert client.delete(f"/api/v1/workspaces/{workspace['id']}", headers=headers[0]).status_code == 204
    db.refresh(documents[0])
    assert documents[0].workspace_id is None
    assert db.get(Document, documents[0].id) is not None
