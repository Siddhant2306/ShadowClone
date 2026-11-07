from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import database
from app.dependencies import account
import secrets
import time
from sqlalchemy import select
from app.models import Conversation, Profile, Memory
from app.schemas.conversation import ChannelInput, TurnInput, Resolution
from app.reasoning import reason
from fastapi import File, UploadFile, Response
from app import gnani
from app.models.voice import Voice
from app.services.audio import wav_audio

router = APIRouter(tags=["conversations"])


@router.post("/api/conversations/{cid}/audio-turn")
async def audio_turn(cid: str, file: UploadFile = File(...), uid=Depends(account), db: Session = Depends(database)):
    row = owned_conversation(cid, uid, db)
    if row.status != "listening":
        raise HTTPException(409, "Conversation is not listening")
    if not db.get(Voice, uid):
        raise HTTPException(409, "Enrol your voice in Voice identity first")
    transcript = await gnani.transcribe(await wav_audio(file))
    if not transcript.strip():
        raise HTTPException(422, "No speech recognized. Please try again.")
    if len(transcript) > 4000:
        raise HTTPException(422, "Please record a shorter question")
    return await turn(cid, TurnInput(text=transcript), uid, db)


@router.post("/api/conversations/{cid}/speech")
async def speak_reply(cid: str, uid=Depends(account), db: Session = Depends(database)):
    row = owned_conversation(cid, uid, db)
    if row.status != "listening" or not row.transcript or row.transcript[-1]["role"] != "assistant":
        raise HTTPException(409, "Approve the response before speaking")
    voice = db.get(Voice, uid)
    if not voice:
        raise HTTPException(409, "Enrol your voice in Voice identity first")
    audio = await gnani.synthesize(row.transcript[-1]["content"], voice.embedding)
    return Response(audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})


@router.post("/api/conversations")
def create_conversation(
    body: ChannelInput, uid=Depends(account), db: Session = Depends(database)
):
    row = Conversation(
        id=secrets.token_hex(16),
        user_id=uid,
        channel=body.channel,
        status="listening",
        started_at=int(time.time()),
        transcript=[
            {
                "role": "assistant",
                "content": "Hello. I am an AI representative. My owner reviews every proposed response before it is shared.",
            }
        ],
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


def owned_conversation(cid, uid, db):
    row = db.get(Conversation, cid)
    if not row or row.user_id != uid:
        raise HTTPException(404, "Conversation not found")
    return row


@router.get("/api/conversations")
def conversation_list(uid=Depends(account), db: Session = Depends(database)):
    return [
        {
            "id": r.id,
            "channel": r.channel,
            "status": r.status,
            "started_at": r.started_at,
            "transcript": r.transcript,
        }
        for r in db.scalars(
            select(Conversation)
            .where(Conversation.user_id == uid)
            .order_by(Conversation.started_at.desc())
        )
    ]


@router.post("/api/conversations/{cid}/turn")
async def turn(
    cid: str, body: TurnInput, uid=Depends(account), db: Session = Depends(database)
):
    row = owned_conversation(cid, uid, db)
    if row.status != "listening":
        raise HTTPException(409, "Conversation is not listening")
    profile = db.get(Profile, uid)
    terms = set(body.text.lower().split())
    relevant = [
        m.content
        for m in db.scalars(select(Memory).where(Memory.user_id == uid))
        if terms & set(m.content.lower().split())
    ][:5]
    reply = await reason(
        {
            "profile": profile.data if profile else {},
            "memories": relevant,
            "history": row.transcript[-12:],
            "question": body.text,
            "channel": row.channel,
        }
    )
    # Fail closed: every generated response requires explicit owner approval.
    # No model classification can release content independently.
    row.transcript = row.transcript + [
        {"role": "user", "content": body.text},
        {"role": "pending", "content": reply.response_text, "reason": reply.reason},
    ]
    row.status = "waiting_for_approval"
    db.commit()
    return {"status": row.status, "proposed_response": reply.response_text}


@router.post("/api/conversations/{cid}/resolve")
def resolve(
    cid: str, body: Resolution, uid=Depends(account), db: Session = Depends(database)
):
    row = db.scalar(
        select(Conversation)
        .where(Conversation.id == cid, Conversation.user_id == uid)
        .with_for_update()
    )
    if not row:
        raise HTTPException(404, "Conversation not found")
    if row.status != "waiting_for_approval":
        raise HTTPException(409, "No pending approval")
    if body.approve and not body.text.strip():
        raise HTTPException(422, "Approved response cannot be empty")
    row.transcript = row.transcript[:-1] + [
        {
            "role": "assistant",
            "content": (
                body.text
                if body.approve
                else "I cannot answer that on behalf of my owner."
            ),
        }
    ]
    row.status = "listening"
    db.commit()
    return {"status": row.status}


@router.post("/api/conversations/{cid}/end")
def end_conversation(cid: str, uid=Depends(account), db: Session = Depends(database)):
    row = owned_conversation(cid, uid, db)
    row.status = "completed"
    db.commit()
    return {"status": row.status}


@router.delete("/api/conversations/{cid}")
def delete_conversation(
    cid: str, uid=Depends(account), db: Session = Depends(database)
):
    db.delete(owned_conversation(cid, uid, db))
    db.commit()
    return {"ok": True}
