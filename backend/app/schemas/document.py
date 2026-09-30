from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentRead(BaseModel):
    id: UUID
    filename: str
    content_type: str
    size_bytes: int | None
    status: str
    workspace_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentList(BaseModel):
    items: list[DocumentRead]
    total: int


class DocumentWorkspaceUpdate(BaseModel):
    workspace_id: UUID | None
