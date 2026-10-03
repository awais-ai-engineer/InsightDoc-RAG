import logging
from uuid import UUID

from openai import APIConnectionError, APIError, APIStatusError, APITimeoutError, OpenAI
from sqlalchemy.orm import Session

from ..core.config import settings
from .retrieval_service import search_user_documents


logger = logging.getLogger(__name__)
PROVIDER_TIMEOUT_SECONDS = 20.0
PROVIDER_MAX_RETRIES = 1


class ProviderError(RuntimeError):
    pass


def _valid_api_key(key: str | None) -> bool:
    return bool(
        key
        and len(key) >= 20
        and key.isascii()
        and key.isprintable()
        and not any(character.isspace() for character in key)
    )


def _log_provider_failure(
    reason: str,
    *,
    status_code: int | None = None,
    request_id: str | None = None,
    error_type: str | None = None,
) -> None:
    logger.warning(
        "AI provider request failed: provider=openrouter model=%s reason=%s error_type=%s status=%s request_id=%s",
        settings.llm_model,
        reason,
        error_type,
        status_code,
        request_id,
    )


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

    if not _valid_api_key(settings.openrouter_api_key):
        key = settings.openrouter_api_key or ""
        logger.warning(
            "AI provider configuration invalid: provider=openrouter model=%s reason=missing_or_malformed_api_key "
            "key_present=%s key_length=%s key_prefix_valid=%s key_has_whitespace=%s key_has_control=%s",
            settings.llm_model,
            bool(key),
            len(key),
            key.startswith("sk-or-v1-"),
            any(character.isspace() for character in key),
            any(ord(character) < 32 or ord(character) == 127 for character in key),
        )
        raise ProviderError("OpenRouter API key is missing or malformed")

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

    try:
        client = OpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            timeout=PROVIDER_TIMEOUT_SECONDS,
            max_retries=PROVIDER_MAX_RETRIES,
        )
        response = client.chat.completions.create(
            model=settings.llm_model,
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
    except APITimeoutError as exc:
        _log_provider_failure("timeout", error_type=type(exc).__name__)
        raise ProviderError("OpenRouter request timed out") from exc
    except APIConnectionError as exc:
        _log_provider_failure("connection", error_type=type(exc).__name__)
        raise ProviderError("OpenRouter connection failed") from exc
    except APIStatusError as exc:
        reason = (
            "authentication" if exc.status_code in (401, 403)
            else "rate_limit" if exc.status_code == 429
            else "upstream_unavailable" if exc.status_code >= 500
            else "request_rejected"
        )
        _log_provider_failure(reason, status_code=exc.status_code, request_id=exc.request_id, error_type=type(exc).__name__)
        raise ProviderError(f"OpenRouter {reason}") from exc
    except APIError as exc:
        _log_provider_failure("api_error", error_type=type(exc).__name__)
        raise ProviderError("OpenRouter request failed") from exc
    except Exception as exc:
        _log_provider_failure("unexpected", error_type=type(exc).__name__)
        raise ProviderError("OpenRouter request failed") from exc

    if not response.choices or not response.choices[0].message.content:
        _log_provider_failure("empty_response")
        raise ProviderError("OpenRouter returned no answer")

    answer = response.choices[0].message.content

    return {
        "answer": answer,
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
