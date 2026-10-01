from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import engine,get_db
from app.main import app
from app.models.document import Document
from app.models.user import User

@pytest.fixture
def context(monkeypatch):
    monkeypatch.setattr(settings,"jwt_secret_key","test-secret-key-with-at-least-thirty-two-bytes")
    connection=engine.connect();transaction=connection.begin();db=Session(bind=connection,join_transaction_mode="create_savepoint",expire_on_commit=False)
    users=[User(email=f"fav-{uuid4()}@example.com",password_hash="unused") for _ in range(2)];db.add_all(users);db.commit()
    docs=[Document(user_id=u.id,filename=f"{i}.txt",content_type="text/plain",status="ready") for i,u in enumerate(users)];db.add_all(docs);db.commit()
    app.dependency_overrides[get_db]=lambda:db;client=TestClient(app);headers=[{"Authorization":f"Bearer {create_access_token(str(u.id))}"} for u in users]
    try:yield client,db,docs,headers
    finally:client.close();app.dependency_overrides.clear();db.close();transaction.rollback();connection.close()

def test_owner_can_favorite_unfavorite_and_list(context):
    client,_,docs,headers=context
    assert client.patch(f"/api/v1/documents/{docs[0].id}/favorite",headers=headers[0],json={"is_favorite":True}).json()["is_favorite"] is True
    listing=client.get("/api/v1/documents?favorite=true",headers=headers[0]).json()
    assert [item["id"] for item in listing["items"]]==[str(docs[0].id)]
    assert client.patch(f"/api/v1/documents/{docs[0].id}/favorite",headers=headers[0],json={"is_favorite":False}).json()["is_favorite"] is False
    assert client.get("/api/v1/documents?favorite=true",headers=headers[0]).json()["items"]==[]

def test_favorites_are_owner_scoped(context):
    client,_,docs,headers=context
    assert client.patch(f"/api/v1/documents/{docs[1].id}/favorite",headers=headers[0],json={"is_favorite":True}).status_code==404
    client.patch(f"/api/v1/documents/{docs[1].id}/favorite",headers=headers[1],json={"is_favorite":True})
    assert client.get("/api/v1/documents?favorite=true",headers=headers[0]).json()["items"]==[]
