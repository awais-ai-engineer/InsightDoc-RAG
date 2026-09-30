from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models.document import Document
from ...models.document_chunk import DocumentChunk
from ...models.user import User
from ...schemas.document import DocumentList, DocumentRead, DocumentWorkspaceUpdate
from ...models.workspace import Workspace
from ...services.ingestion_service import ingest_document
from ...services.storage import UploadTooLargeError, save_upload
from ..dependencies import get_current_user


router = APIRouter(prefix="/documents", tags=["documents"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".docx",
}

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.post(
    "/upload",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRead:
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF, TXT, and DOCX files are supported",
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file content type",
        )

    try:
        storage_key, size_bytes = await save_upload(
            file,
            max_bytes=MAX_UPLOAD_BYTES,
        )
    except UploadTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 50 MB upload limit",
        )

    document = Document(
        user_id=current_user.id,
        filename=filename,
        content_type=file.content_type or "application/octet-stream",
        storage_key=storage_key,
        size_bytes=size_bytes,
        status="uploaded",
    )

    try:
        db.add(document)
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        Path(storage_key).unlink(missing_ok=True)
        raise

    try:
        ingest_document(db, document)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Document processing failed; the document was saved with failed status",
        ) from exc

    db.refresh(document)
    return DocumentRead.model_validate(document)


@router.get("", response_model=DocumentList)
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DocumentList:
    owned = Document.user_id == current_user.id
    total = db.scalar(select(func.count()).select_from(Document).where(owned)) or 0
    documents = db.scalars(
        select(Document)
        .where(owned)
        .order_by(Document.created_at.desc(), Document.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return DocumentList(items=[DocumentRead.model_validate(doc) for doc in documents], total=total)


def get_owned_document(db: Session, document_id: UUID, user_id: UUID) -> Document:
    document = db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRead:
    return DocumentRead.model_validate(get_owned_document(db, document_id, current_user.id))


@router.patch("/{document_id}/workspace", response_model=DocumentRead)
def assign_document_workspace(payload: DocumentWorkspaceUpdate, document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DocumentRead:
    document = get_owned_document(db, document_id, current_user.id)
    if payload.workspace_id is not None:
        workspace = db.scalar(select(Workspace).where(Workspace.id == payload.workspace_id, Workspace.user_id == current_user.id))
        if workspace is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
    document.workspace_id = payload.workspace_id
    db.commit()
    db.refresh(document)
    return DocumentRead.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    document = get_owned_document(db, document_id, current_user.id)
    storage_key = document.storage_key
    try:
        db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
        db.delete(document)
        db.commit()
    except Exception:
        db.rollback()
        raise
    if storage_key:
        Path(storage_key).unlink(missing_ok=True)
