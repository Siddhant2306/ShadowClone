"""Regression checks for the Gnani synthesis request."""

import asyncio
import httpx
from app import gnani


def test_cloned_synthesis_selects_model(monkeypatch):
    async def request(path, **kwargs):
        assert path == "/api/v1/tts/inference"
        assert kwargs["json"]["model"] == "vachana-vc-v1"
        assert kwargs["json"]["speaker_embedding"] == {"embedding": "test"}
        return httpx.Response(200, content=b"RIFFtest-wave")

    monkeypatch.setattr(gnani, "request", request)
    assert asyncio.run(gnani.synthesize("Hello", {"embedding": "test"})).startswith(
        b"RIFF"
    )
