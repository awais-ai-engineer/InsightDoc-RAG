from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models.document import Document
from ...models.user import User
from ...schemas.chat import QueryRequest, QueryResponse
from ...services.rag_service import ProviderError, answer_question
from ..dependencies import get_current_user


router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/query", response_model=QueryResponse)
def query_documents(
    payload: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QueryResponse:
    if payload.document_ids:
        documents = db.scalars(
            select(Document).where(
                Document.id.in_(payload.document_ids),
                Document.user_id == current_user.id,
            )
        ).all()
        if len(documents) != len(payload.document_ids):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        if any(document.status != "ready" for document in documents):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="All selected documents must be ready",
            )

    try:
        result = answer_question(
            db,
            user_id=current_user.id,
            question=payload.question,
            top_k=payload.top_k,
            document_ids=payload.document_ids,
        )
    except ProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The language model provider is currently unavailable",
        ) from exc

    return QueryResponse(answer=result["answer"], citations=result["sources"])
