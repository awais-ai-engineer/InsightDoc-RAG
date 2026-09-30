from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models.document import Document
from ..models.document_chunk import DocumentChunk
from .document_service import process_document
from .embedding_service import embed_texts


def ingest_document(
    db: Session,
    document: Document,
) -> int:
    if not document.storage_key:
        raise ValueError("Document does not have a storage path")

    file_path = Path(document.storage_key)

    if not file_path.exists():
        raise FileNotFoundError(
            f"Document file was not found: {file_path}"
        )

    document.status = "processing"
    db.commit()

    try:
        chunks = process_document(str(file_path))

        if not chunks:
            raise ValueError("No readable text was found in the document")

        texts = [chunk["text"] for chunk in chunks]
        embeddings = embed_texts(texts)
        if len(embeddings) != len(chunks) or any(len(embedding) != 384 for embedding in embeddings):
            raise ValueError("Embedding output did not match the document chunks or dimension")

        db.execute(
            delete(DocumentChunk).where(
                DocumentChunk.document_id == document.id
            )
        )

        rows = [
            DocumentChunk(
                document_id=document.id,
                chunk_index=index,
                page_number=chunk["page"],
                content=chunk["text"],
                embedding=embedding,
            )
            for index, (chunk, embedding) in enumerate(
                zip(chunks, embeddings)
            )
        ]

        db.add_all(rows)

        document.status = "ready"
        db.commit()

        return len(rows)

    except Exception:
        db.rollback()

        document.status = "failed"
        db.add(document)
        db.commit()

        raise
