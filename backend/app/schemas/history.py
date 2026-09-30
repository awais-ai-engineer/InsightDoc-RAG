from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .chat import Citation


class ChatCreate(BaseModel):
    title: str = Field(default="New chat", min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title must not be blank")
        return value


class MessageRead(BaseModel):
    id: UUID
    role: str
    content: str
    citations: list[Citation] | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChatRead(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChatDetail(ChatRead):
    messages: list[MessageRead]


class ChatList(BaseModel):
    items: list[ChatRead]
    total: int


class MessageCreate(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_ids: list[UUID] | None = None
    top_k: int = Field(default=5, ge=1, le=10)

    @field_validator("question")
    @classmethod
    def trim_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Question must not be blank")
        return value


class MessageExchange(BaseModel):
    user_message: MessageRead
    assistant_message: MessageRead
