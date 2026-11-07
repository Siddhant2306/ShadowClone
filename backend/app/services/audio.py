"""Reference and transcription upload validation."""

import io
import wave
from fastapi import HTTPException, UploadFile


async def wav_audio(file: UploadFile, minimum=0.2):
    data = await file.read(5_000_001)
    if len(data) > 5_000_000:
        raise HTTPException(413, "Audio exceeds 5 MB")
    try:
        with wave.open(io.BytesIO(data)) as audio:
            duration = audio.getnframes() / audio.getframerate()
            if (
                audio.getnchannels() != 1
                or audio.getsampwidth() != 2
                or not minimum <= duration <= 30
            ):
                raise ValueError()
    except (wave.Error, EOFError, ValueError):
        raise HTTPException(422, f"Use mono 16-bit PCM WAV, {minimum}-30 seconds")
    return data
