from uuid import UUID

from openai import OpenAI
from sqlalchemy.orm import Session

from ..core.config import settings
from .retrieval_service import search_user_documents


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openrouter/free"


def answer_question(
    db: Session,
    *,
    user_id: UUID,
    question: str,
    top_k: int = 5,
) -> dict:
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    retrieved = search_user_documents(
        db,
        user_id=user_id,
        query=question,
        top_k=top_k,
    )

    if not retrieved:
        return {
            "answer": (
                "I could not find relevant information "
                "in your uploaded documents."
            ),
            "sources": [],
        }

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

    answer = response.choices[0].message.content

    return {
        "answer": answer or "",
        "sources": retrieved,
    }
