from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import database
from app.dependencies import account
import os
import time
from fastapi import File, Form, Response, UploadFile
from app import gnani
from app.models.voice import Voice
from app.services.audio import wav_audio

router = APIRouter(tags=["voice"])


@router.get("/api/voice")
def voice_status(uid=Depends(account), db: Session = Depends(database)):
    return {
        "status": "ready" if db.get(Voice, uid) else "not_started",
        "configured": bool(os.getenv("GNANI_API_KEY")),
    }


@router.post("/api/voice/enrol")
async def enrol_voice(
    file: UploadFile = File(...),
    consent: bool = Form(...),
    uid=Depends(account),
    db: Session = Depends(database),
):
    if not consent:
        raise HTTPException(422, "Explicit consent to clone your own voice is required")
    audio = await wav_audio(file, 5)
    embedding = await gnani.enrol(audio)
    db.merge(Voice(user_id=uid, embedding=embedding, consent_at=int(time.time())))
    db.commit()
    return {"status": "ready"}


@router.delete("/api/voice")
def revoke_voice(uid=Depends(account), db: Session = Depends(database)):
    row = db.get(Voice, uid)
    if row:
        db.delete(row)
        db.commit()
    return {"status": "revoked"}


@router.post("/api/voice/test")
async def test_voice(uid=Depends(account), db: Session = Depends(database)):
    row = db.get(Voice, uid)
    if not row:
        raise HTTPException(409, "Enrol your voice first")
    data = await gnani.synthesize(
        "Hello. I am an AI voice representative, speaking with the consent of my owner.",
        row.embedding,
    )
    return Response(data, media_type="audio/wav")


@router.post("/api/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...), uid=Depends(account)):
    return {"transcript": await gnani.transcribe(await wav_audio(file))}
