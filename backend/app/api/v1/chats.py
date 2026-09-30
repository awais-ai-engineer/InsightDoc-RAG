from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models.chat import Chat
from ...models.document import Document
from ...models.message import Message
from ...models.user import User
from ...schemas.history import ChatCreate, ChatDetail, ChatList, ChatRead, MessageCreate, MessageExchange, MessageRead
from ...services.rag_service import ProviderError, answer_question
from ..dependencies import get_current_user


router = APIRouter(prefix="/chats", tags=["chats"])


def owned_chat(db: Session, chat_id: UUID, user_id: UUID) -> Chat:
    chat = db.scalar(select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id))
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.post("", response_model=ChatRead, status_code=status.HTTP_201_CREATED)
def create_chat(payload: ChatCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = Chat(user_id=current_user.id, title=payload.title)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


@router.get("", response_model=ChatList)
def list_chats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    owned = Chat.user_id == current_user.id
    total = db.scalar(select(func.count()).select_from(Chat).where(owned)) or 0
    items = db.scalars(select(Chat).where(owned).order_by(Chat.updated_at.desc(), Chat.id.desc()).limit(limit).offset(offset)).all()
    return ChatList(items=items, total=total)


@router.get("/{chat_id}", response_model=ChatDetail)
def get_chat(chat_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = owned_chat(db, chat_id, current_user.id)
    messages = db.scalars(select(Message).where(Message.chat_id == chat.id).order_by(Message.position)).all()
    return ChatDetail.model_validate({**ChatRead.model_validate(chat).model_dump(), "messages": messages})


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat(chat_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    chat = owned_chat(db, chat_id, current_user.id)
    db.execute(delete(Message).where(Message.chat_id == chat.id))
    db.delete(chat)
    db.commit()


@router.post("/{chat_id}/messages", response_model=MessageExchange, status_code=status.HTTP_201_CREATED)
def post_message(payload: MessageCreate, chat_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.scalar(select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id).with_for_update())
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    if payload.document_ids:
        count = db.scalar(select(func.count()).select_from(Document).where(Document.id.in_(payload.document_ids), Document.user_id == current_user.id, Document.status == "ready")) or 0
        if count != len(set(payload.document_ids)):
            raise HTTPException(status_code=404, detail="Ready document not found")
    try:
        result = answer_question(db, user_id=current_user.id, question=payload.question, top_k=payload.top_k, document_ids=payload.document_ids)
        last_position = db.scalar(select(func.max(Message.position)).where(Message.chat_id == chat.id)) or 0
        user_message = Message(chat_id=chat.id, role="user", position=last_position + 1, content=payload.question)
        assistant_message = Message(chat_id=chat.id, role="assistant", position=last_position + 2, content=result["answer"], citations=result["sources"])
        db.add_all([user_message, assistant_message])
        chat.updated_at = func.now()
        db.commit()
        db.refresh(user_message)
        db.refresh(assistant_message)
    except ProviderError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="The language model provider is currently unavailable") from exc
    return MessageExchange(user_message=MessageRead.model_validate(user_message), assistant_message=MessageRead.model_validate(assistant_message))
