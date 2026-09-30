from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class QueryRequest(BaseModel):
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

    @field_validator("document_ids")
    @classmethod
    def unique_document_ids(cls, value: list[UUID] | None) -> list[UUID] | None:
        if value is None:
            return None
        return list(dict.fromkeys(value))


class Citation(BaseModel):
    chunk_id: UUID
    document_id: UUID
    filename: str
    page_number: int | None
    relevance_score: float


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
