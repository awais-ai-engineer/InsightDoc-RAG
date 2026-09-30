from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models.document import Document
from ...models.user import User
from ...models.workspace import Workspace
from ...schemas.workspace import WorkspaceCreate, WorkspaceList, WorkspaceRead, WorkspaceUpdate
from ..dependencies import get_current_user


router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def owned_workspace(db: Session, workspace_id: UUID, user_id: UUID) -> Workspace:
    workspace = db.scalar(select(Workspace).where(Workspace.id == workspace_id, Workspace.user_id == user_id))
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def workspace_read(db: Session, workspace: Workspace) -> WorkspaceRead:
    count = db.scalar(select(func.count()).select_from(Document).where(Document.workspace_id == workspace.id)) or 0
    data = WorkspaceRead.model_validate(workspace).model_dump()
    data["document_count"] = count
    return WorkspaceRead(**data)


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def create_workspace(payload: WorkspaceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = Workspace(user_id=current_user.id, name=payload.name, description=payload.description)
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace_read(db, workspace)


@router.get("", response_model=WorkspaceList)
def list_workspaces(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    owned = Workspace.user_id == current_user.id
    total = db.scalar(select(func.count()).select_from(Workspace).where(owned)) or 0
    items = db.scalars(select(Workspace).where(owned).order_by(Workspace.updated_at.desc()).limit(limit).offset(offset)).all()
    return WorkspaceList(items=[workspace_read(db, item) for item in items], total=total)


@router.get("/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(workspace_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return workspace_read(db, owned_workspace(db, workspace_id, current_user.id))


@router.patch("/{workspace_id}", response_model=WorkspaceRead)
def update_workspace(payload: WorkspaceUpdate, workspace_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = owned_workspace(db, workspace_id, current_user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(workspace, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(workspace)
    return workspace_read(db, workspace)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(workspace_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    workspace = owned_workspace(db, workspace_id, current_user.id)
    db.execute(update(Document).where(Document.workspace_id == workspace.id, Document.user_id == current_user.id).values(workspace_id=None))
    db.delete(workspace)
    db.commit()
