from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from openai import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    PermissionDeniedError,
    RateLimitError,
)

from app.core.config import settings
from app.services import rag_service
from app.services.rag_service import ProviderError


def retrieved_context():
    return [{
        "chunk_id": str(uuid4()),
        "document_id": str(uuid4()),
        "filename": "brief.txt",
        "page_number": 12,
        "content": "Three supported opportunities.",
        "relevance_score": 0.9,
    }]


@pytest.fixture
def provider_setup(monkeypatch):
    context = retrieved_context()
    monkeypatch.setattr(rag_service, "search_user_documents", lambda *args, **kwargs: context)
    monkeypatch.setattr(settings, "openrouter_api_key", "sk-or-v1-" + "x" * 32)
    monkeypatch.setattr(settings, "llm_model", "openrouter/free")
    return context


def test_provider_request_preserves_grounding_and_uses_bounded_client(provider_setup, monkeypatch):
    captured = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured["client"] = kwargs
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

        def create(self, **kwargs):
            captured["request"] = kwargs
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Grounded answer"))])

    monkeypatch.setattr(rag_service, "OpenAI", FakeOpenAI)
    result = rag_service.answer_question(None, user_id=uuid4(), question="What is supported?")

    assert captured["client"] == {
        "api_key": settings.openrouter_api_key,
        "base_url": settings.openrouter_base_url,
        "timeout": 20.0,
        "max_retries": 1,
    }
    assert captured["request"]["model"] == "openrouter/free"
    assert captured["request"]["messages"][0]["role"] == "system"
    assert "Three supported opportunities." in captured["request"]["messages"][1]["content"]
    assert "What is supported?" in captured["request"]["messages"][1]["content"]
    assert result["answer"] == "Grounded answer"
    assert result["sources"][0]["page_number"] == 12


@pytest.mark.parametrize("key", [None, "", "\x01", "short", "sk-or-v1-" + "x" * 10 + "\n"])
def test_malformed_key_fails_before_network(provider_setup, monkeypatch, key):
    monkeypatch.setattr(settings, "openrouter_api_key", key)
    monkeypatch.setattr(rag_service, "OpenAI", lambda **kwargs: pytest.fail("provider client must not be created"))
    with pytest.raises(ProviderError, match="missing or malformed"):
        rag_service.answer_question(None, user_id=uuid4(), question="Question")


@pytest.mark.parametrize(
    ("error_type", "status", "reason"),
    [
        (BadRequestError, 400, "request_rejected"),
        (AuthenticationError, 401, "authentication"),
        (PermissionDeniedError, 403, "authentication"),
        (RateLimitError, 429, "rate_limit"),
        (InternalServerError, 503, "upstream_unavailable"),
    ],
)
def test_provider_http_errors_are_classified_without_secrets(provider_setup, monkeypatch, caplog, error_type, status, reason):
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    response = httpx.Response(status, request=request, headers={"x-request-id": "test-request"})
    error = error_type("provider detail", response=response, body={"error": "provider detail"})

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=lambda **kwargs: (_ for _ in ()).throw(error)))

    monkeypatch.setattr(rag_service, "OpenAI", FakeOpenAI)
    with pytest.raises(ProviderError, match=reason):
        rag_service.answer_question(None, user_id=uuid4(), question="Question")
    assert f"reason={reason}" in caplog.text
    assert f"status={status}" in caplog.text
    assert "provider detail" not in caplog.text
    assert settings.openrouter_api_key not in caplog.text


@pytest.mark.parametrize("error_type", [APITimeoutError, APIConnectionError])
def test_provider_transport_failures_are_mapped(provider_setup, monkeypatch, error_type):
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    error = error_type(request=request)

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=lambda **kwargs: (_ for _ in ()).throw(error)))

    monkeypatch.setattr(rag_service, "OpenAI", FakeOpenAI)
    with pytest.raises(ProviderError):
        rag_service.answer_question(None, user_id=uuid4(), question="Question")


def test_empty_provider_response_is_rejected(provider_setup, monkeypatch):
    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(
                create=lambda **kwargs: SimpleNamespace(choices=[
                    SimpleNamespace(message=SimpleNamespace(content=None)),
                ]),
            ))

    monkeypatch.setattr(rag_service, "OpenAI", FakeOpenAI)
    with pytest.raises(ProviderError, match="no answer"):
        rag_service.answer_question(None, user_id=uuid4(), question="Question")
