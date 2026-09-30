from uuid import UUID

from openai import OpenAI
from sqlalchemy.orm import Session

from ..core.config import settings
from .retrieval_service import search_user_documents


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openrouter/free"


class ProviderError(RuntimeError):
    pass


def answer_question(
    db: Session,
    *,
    user_id: UUID,
    question: str,
    top_k: int = 5,
    document_ids: list[UUID] | None = None,
) -> dict:
    retrieved = search_user_documents(
        db,
        user_id=user_id,
        query=question,
        top_k=top_k,
        document_ids=document_ids,
    )

    if not retrieved:
        return {
            "answer": (
                "I could not find relevant information "
                "in your uploaded documents."
            ),
            "sources": [],
        }

    if not settings.openrouter_api_key:
        raise ProviderError("The language model provider is not configured")

    context_sections = []

    for index, item in enumerate(retrieved, start=1):
        page = (
            f"page {item['page_number']}"
            if item["page_number"] is not None
            else "page unavailable"
        )

        context_sections.append(
            f"[SOURCE {index}]\n"
            f"File: {item['filename']}\n"
            f"Location: {page}\n"
            f"Content:\n{item['content']}"
        )

    context = "\n\n".join(context_sections)

    client = OpenAI(
        api_key=settings.openrouter_api_key,
        base_url=OPENROUTER_BASE_URL,
    )

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
            {
                "role": "system",
                "content": (
                    "You are InsightDoc, an AI document assistant. "
                    "Answer using only the supplied document context. "
                    "Do not invent information. "
                    "If the answer is not supported by the context, "
                    "say that the uploaded documents do not contain "
                    "enough information. "
                    "When useful, reference sources as [SOURCE 1], "
                    "[SOURCE 2], and so on."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"DOCUMENT CONTEXT:\n\n{context}\n\n"
                    f"QUESTION:\n{question}"
                ),
            },
            ],
            temperature=0.2,
            max_tokens=800,
        )
    except Exception as exc:
        raise ProviderError("The configured language model provider is unavailable") from exc

    answer = response.choices[0].message.content

    return {
        "answer": answer or "",
        "sources": [
            {
                key: item[key]
                for key in (
                    "chunk_id",
                    "document_id",
                    "filename",
                    "page_number",
                    "relevance_score",
                )
            }
            for item in retrieved
        ],
    }
