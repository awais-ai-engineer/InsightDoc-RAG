from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.document import Document
from ..models.document_chunk import DocumentChunk
from .embedding_service import embed_query


def search_user_documents(
    db: Session,
    *,
    user_id: UUID,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    query_embedding = embed_query(query)

    distance = DocumentChunk.embedding.cosine_distance(
        query_embedding
    ).label("distance")

    statement = (
        select(
            DocumentChunk,
            Document.filename,
            distance,
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id,
        )
        .where(
            Document.user_id == user_id,
            Document.status == "ready",
        )
        .order_by(distance)
        .limit(top_k)
    )

    results = db.execute(statement).all()

    return [
        {
            "chunk_id": str(chunk.id),
            "document_id": str(chunk.document_id),
            "filename": filename,
            "page_number": chunk.page_number,
            "content": chunk.content,
            "score": max(0.0, 1.0 - float(distance_value)),
        }
        for chunk, filename, distance_value in results
    ]
