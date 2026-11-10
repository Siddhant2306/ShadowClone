"""Provider contract tests; external requests are mocked here."""

import asyncio
import json

import httpx
import pytest
from fastapi import HTTPException

from app.reasoning import reason, system_prompt


class FakeStream:
    def __init__(self, lines):
        self.lines = lines

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    def raise_for_status(self):
        return None

    async def aiter_lines(self):
        for line in self.lines:
            yield line


def ollama_lines(content):
    fragments = [content[:20], content[20:]]
    return [
        json.dumps({"message": {"content": fragment}, "done": False})
        for fragment in fragments
    ] + [json.dumps({"done": True})]


def test_ollama_stream_schema_and_no_cloud_key(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_MODEL", "qwen3:4b")
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    content = json.dumps(
        {
            "response_text": "Hello",
            "confidence": 0.9,
            "requires_approval": False,
            "reason": "Greeting",
        }
    )
    first_token = []

    def stream(self, method, url, **kwargs):
        assert method == "POST"
        assert url == "http://127.0.0.1:11434/api/chat"
        payload = kwargs["json"]
        assert payload["format"]["type"] == "object"
        assert payload["stream"] is True
        assert payload["think"] is False
        return FakeStream(ollama_lines(content))

    monkeypatch.setattr(httpx.AsyncClient, "stream", stream)
    reply = asyncio.run(reason({}, on_first_token=lambda: first_token.append(True)))
    assert reply.response_text == "Hello"
    assert first_token == [True]


def test_ollama_rejects_invalid_stream_output(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_MODEL", "qwen3:4b")

    def stream(self, method, url, **kwargs):
        return FakeStream(ollama_lines("not JSON"))

    monkeypatch.setattr(httpx.AsyncClient, "stream", stream)
    with pytest.raises(HTTPException) as error:
        asyncio.run(reason({}))
    assert error.value.status_code == 502


def test_anthropic_stream_separates_and_caches_meeting_context(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("LLM_MODEL", "claude-test")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    content = json.dumps(
        {
            "response_text": "The target is Friday.",
            "confidence": 0.9,
            "requires_approval": False,
            "reason": "Supported by context",
        }
    )
    request_payload = {}
    first_token = []

    def stream(self, method, url, **kwargs):
        assert method == "POST"
        request_payload.update(kwargs["json"])
        return FakeStream(
            [
                "data: "
                + json.dumps(
                    {
                        "type": "content_block_delta",
                        "delta": {"type": "text_delta", "text": content},
                    }
                ),
                'data: {"type":"message_stop"}',
            ]
        )

    monkeypatch.setattr(httpx.AsyncClient, "stream", stream)
    reply = asyncio.run(
        reason(
            {
                "owner": {"name": "Siddhant"},
                "profile": {"communication_style": "Concise"},
                "meeting_context": "Target is Friday.",
                "question": "When is it due?",
                "history": [],
                "memories": [],
            },
            on_first_token=lambda: first_token.append(True),
        )
    )
    assert reply.response_text == "The target is Friday."
    assert request_payload["stream"] is True
    assert request_payload["system"][1]["cache_control"] == {"type": "ephemeral"}
    stable_context = request_payload["system"][1]["text"]
    assert "Target is Friday." in stable_context
    assert "question" not in stable_context
    assert first_token == [True]


def test_prompt_includes_language_and_tone_mirroring():
    prompt = system_prompt()
    assert "Hinglish (including Hindi in Roman script)" in prompt
    assert "immediately if the participant switches language" in prompt
