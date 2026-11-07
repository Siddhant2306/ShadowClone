"""Gnani REST contracts verified against docs.gnani.ai, 2026-11-07."""

import os
import httpx
from fastapi import HTTPException


async def request(path, **kwargs):
    key = os.getenv("GNANI_API_KEY")
    if not key:
        raise HTTPException(503, "Configure GNANI_API_KEY on the backend")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            result = await client.post(
                "https://api.vachana.ai" + path, headers={"X-API-Key-ID": key}, **kwargs
            )
        if not result.is_success:
            raise HTTPException(
                502, f"Gnani request failed (HTTP {result.status_code})"
            )
        return result
    except httpx.HTTPError:
        raise HTTPException(502, "Gnani connection failed")


async def enrol(audio):
    result = (
        await request(
            "/api/v1/tts/voice-clone/embeddings",
            files={"audio_file": ("reference.wav", audio, "audio/wav")},
        )
    ).json()
    try:
        embedding = result["data"]["voice_clone_embedding"]
        if not result["success"] or not all(
            k in embedding for k in ["embedding", "shape", "dtype"]
        ):
            raise ValueError()
        return embedding
    except (KeyError, ValueError, TypeError):
        raise HTTPException(502, "Invalid Gnani embedding response")


async def transcribe(audio):
    data = (
        await request(
            "/stt/v3",
            files={"audio_file": ("turn.wav", audio, "audio/wav")},
            data={"language_code": "indic-auto", "model": "prisma-v3.0"},
        )
    ).json()
    if not data.get("success") or not isinstance(data.get("transcript"), str):
        raise HTTPException(502, "Invalid Gnani transcript response")
    return data["transcript"]


async def synthesize(text, embedding):
    result = await request(
        "/api/v1/tts/inference",
        json={
            "text": text,
            "speaker_embedding": embedding,
            "audio_config": {
                "sample_rate": 24000,
                "num_channels": 1,
                "sample_width": 2,
                "encoding": "linear_pcm",
                "container": "wav",
            },
        },
    )
    if not result.content.startswith(b"RIFF"):
        raise HTTPException(502, "Gnani returned invalid WAV audio")
    return result.content
