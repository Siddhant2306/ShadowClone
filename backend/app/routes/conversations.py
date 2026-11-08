import asyncio
import hashlib
import json
import logging
import os
import time
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from app.config import ALLOWED_ORIGINS
from app.database import database
from app.dependencies import account
from app.models import Conversation, Profile, Memory
from app.schemas.conversation import ChannelInput, TurnInput, Resolution
from app.reasoning import reason
from fastapi import File, UploadFile, Response
from app import gnani
from app.models.voice import Voice
from app.models.auth import LoginSession
from app.services.audio import validate_live_wav, wav_audio
import secrets
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

router = APIRouter(tags=["conversations"])
AI_DISCLOSURE = "I'm an AI assistant speaking with my owner's permission."


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
    if body.channel == "google_meet_live":
        if not body.participants_consented:
            raise HTTPException(
                422, "Confirm that all meeting participants were informed and consented"
            )
        if not db.get(Voice, uid):
            raise HTTPException(409, "Enrol your voice in Voice identity first")
        if not os.getenv("GNANI_API_KEY"):
            raise HTTPException(503, "Configure GNANI_API_KEY on the backend")

    row = Conversation(
        id=secrets.token_hex(16),
        user_id=uid,
        channel=body.channel,
        status="listening",
        started_at=int(time.time()),
        transcript=[
            {
                "role": "assistant",
                "content": (
                    "I'm an AI assistant speaking with my owner's permission."
                    if body.channel == "google_meet_live"
                    else "Hello. I am an AI representative. My owner reviews every proposed response before it is shared."
                ),
            }
        ],
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


async def process_live_audio(websocket, row, uid, db, voice, audio, stopped):
    try:
        wav = validate_live_wav(audio)
        await websocket.send_json({"type": "status", "status": "transcribing"})
        transcript = (await gnani.transcribe(wav)).strip()
        if not transcript:
            await websocket.send_json({"type": "ignored"})
            return
        if len(transcript) > 4000:
            await websocket.send_json(
                {"type": "error", "message": "That utterance was too long to process"}
            )
            return

        await websocket.send_json({"type": "transcript", "text": transcript})
        await websocket.send_json({"type": "status", "status": "thinking"})
        profile = db.get(Profile, uid)
        terms = set(transcript.lower().split())
        relevant = [
            memory.content
            for memory in db.scalars(select(Memory).where(Memory.user_id == uid))
            if terms & set(memory.content.lower().split())
        ][:5]
        reply = await reason(
            {
                "profile": profile.data if profile else {},
                "memories": relevant,
                "history": row.transcript[-12:],
                "question": transcript,
                "channel": row.channel,
            }
        )
        if stopped.is_set() or row.status != "live":
            return

        if reply.requires_approval:
            answer = "This needs my owner's input, so I can't answer it during this session."
        else:
            answer = reply.response_text
        response_text = f"{AI_DISCLOSURE} {answer}"
        if len(response_text) > 1000:
            raise HTTPException(
                422, "The generated reply is too long to speak in a live meeting"
            )
        await websocket.send_json({"type": "status", "status": "speaking"})
        speech = await gnani.synthesize(response_text, voice.embedding)
        if stopped.is_set() or row.status != "live":
            return

        await websocket.send_json(
            {"type": "reply", "text": response_text, "transcript": transcript}
        )
        await websocket.send_json({"type": "audio", "mime": "audio/wav"})
        await websocket.send_bytes(speech)
        row.transcript = row.transcript + [
            {"role": "user", "content": transcript},
            {"role": "assistant", "content": response_text},
        ]
        db.commit()
    except HTTPException as exc:
        await websocket.send_json({"type": "error", "message": exc.detail})
    except Exception:
        logger.exception("Unexpected live-meeting turn failure")
        await websocket.send_json(
            {"type": "error", "message": "Live response failed; check the backend logs"}
        )
    finally:
        if not stopped.is_set() and row.status == "live":
            await websocket.send_json({"type": "turn_complete"})


@router.websocket("/api/conversations/{cid}/live")
async def live_conversation(
    websocket: WebSocket, cid: str, db: Session = Depends(database)
):
    origin = websocket.headers.get("origin")
    if origin not in ALLOWED_ORIGINS:
        await websocket.close(code=1008)
        return

    token = websocket.cookies.get("shadow_session", "")
    if not token:
        await websocket.close(code=1008)
        return
    login = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not login or login.expires < time.time():
        await websocket.close(code=1008)
        return

    row = db.get(Conversation, cid)
    if (
        not row
        or row.user_id != login.user_id
        or row.channel != "google_meet_live"
    ):
        await websocket.close(code=1008)
        return
    voice = db.get(Voice, login.user_id)
    if not voice:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    result = db.execute(
        update(Conversation)
        .where(Conversation.id == cid, Conversation.status == "listening")
        .values(status="live")
    )
    if result.rowcount != 1:
        await websocket.send_json(
            {"type": "error", "message": "This meeting is not available to start"}
        )
        await websocket.close(code=1008)
        return
    db.commit()
    row.status = "live"

    stopped = asyncio.Event()
    queue = asyncio.Queue(maxsize=1)

    async def process_queue():
        while not stopped.is_set():
            audio = await queue.get()
            if audio is None:
                return
            await process_live_audio(
                websocket, row, login.user_id, db, voice, audio, stopped
            )

    worker = asyncio.create_task(process_queue())
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            if message.get("text"):
                if len(message["text"]) > 64:
                    await websocket.close(code=1009, reason="Command is too large")
                    break
                try:
                    command = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid session command"}
                    )
                    continue
                if command == {"type": "stop"}:
                    row.status = "completed"
                    db.commit()
                    break
                await websocket.send_json(
                    {"type": "error", "message": "Unsupported session command"}
                )
                continue
            audio = message.get("bytes")
            if audio is None:
                continue
            if len(audio) > 5_000_000:
                await websocket.close(code=1009, reason="Audio chunk exceeds 5 MB")
                break
            if queue.full():
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "The assistant is still processing the previous turn",
                    }
                )
                continue
            queue.put_nowait(audio)
    except WebSocketDisconnect:
        pass
    finally:
        stopped.set()
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
        if row.status == "live":
            row.status = "listening"
            db.commit()
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.close()


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
