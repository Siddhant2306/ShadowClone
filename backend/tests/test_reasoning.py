"""Provider contract tests; external requests are mocked here."""

import asyncio
import json

import httpx
import pytest
from fastapi import HTTPException

from app.reasoning import reason


def test_ollama_schema_and_no_cloud_key(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_MODEL", "qwen3:4b")
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    async def post(self, url, **kwargs):
        assert url == "http://127.0.0.1:11434/api/chat"
        payload = kwargs["json"]
        assert payload["format"]["type"] == "object"
        assert payload["stream"] is False
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "done": True,
                "message": {
                    "content": json.dumps(
                        {
                            "response_text": "Hello",
                            "confidence": 0.9,
                            "requires_approval": False,
                            "reason": "Greeting",
                        }
                    )
                },
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    assert asyncio.run(reason({"question": "Hello"})).response_text == "Hello"


def test_ollama_rejects_invalid_output(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_MODEL", "qwen3:4b")

    async def post(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"done": True, "message": {"content": "not JSON"}},
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    with pytest.raises(HTTPException) as error:
        asyncio.run(reason({}))
    assert error.value.status_code == 502
