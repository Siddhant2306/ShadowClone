import asyncio
import hashlib
import json
import logging
import os
import time
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from starlette.concurrency import run_in_threadpool
from app.config import ALLOWED_ORIGINS
from app.database import database
from app.dependencies import account
from app.models import Conversation, MeetingContext, Profile, Memory
from app.schemas.conversation import (
    ChannelInput,
    MeetingContextInput,
    TurnInput,
    Resolution,
)
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


def owner_introduction(profile_data):
    profile_data = profile_data or {}
    owner_name = str(profile_data.get("display_name") or "").strip() or "the owner"
    languages = str(profile_data.get("preferred_languages") or "").lower()
    if "hindi" in languages or "hinglish" in languages:
        return (
            f"Hi everyone, main {owner_name} ka AI assistant hoon. "
            f"{owner_name} abhi available nahi hain, isliye main unki taraf se "
            "meeting attend kar raha hoon. Main important baatein note karke "
            f"meeting ke baad {owner_name} ke saath share karunga."
        )
    return (
        f"Hi everyone, I'm {owner_name}'s AI assistant. {owner_name} is "
        "unavailable right now, so I'm attending on their behalf. I'll note "
        f"the important discussion points and share them with {owner_name} "
        "after the meeting."
    )


def load_live_session(db, cid, token):
    login = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not login or login.expires < time.time():
        return None
    row = db.get(Conversation, cid)
    if (
        not row
        or row.user_id != login.user_id
        or row.channel != "google_meet_live"
    ):
        return None
    voice = db.get(Voice, login.user_id)
    if not voice:
        return None
    profile_row = db.get(Profile, login.user_id)
    profile_data = profile_row.data if profile_row else {}
    meeting_context_row = db.get(MeetingContext, cid)
    return {
        "id": cid,
        "user_id": login.user_id,
        "channel": row.channel,
        "transcript": list(row.transcript),
        "voice_embedding": voice.embedding,
        "active": True,
        "context": {
            "owner": {
                "name": str(profile_data.get("display_name") or "").strip()
                or "the owner",
                "preferred_languages": profile_data.get("preferred_languages", ""),
                "communication_style": profile_data.get("communication_style", ""),
            },
            "profile": profile_data,
            "meeting_context": (
                meeting_context_row.content if meeting_context_row else ""
            ),
            "memories": list(
                db.scalars(
                    select(Memory.content).where(Memory.user_id == login.user_id)
                )
            ),
        },
    }


def update_live_status(db, cid, status, expected_status):
    result = db.execute(
        update(Conversation)
        .where(Conversation.id == cid, Conversation.status == expected_status)
        .values(status=status)
    )
    if result.rowcount == 1:
        db.commit()
        return True
    db.rollback()
    return False


def persist_live_transcript(db, cid, transcript):
    result = db.execute(
        update(Conversation)
        .where(Conversation.id == cid, Conversation.status == "live")
        .values(transcript=transcript)
    )
    if result.rowcount == 1:
        db.commit()
        return True
    db.rollback()
    return False


def load_meeting_context(db, cid):
    row = db.get(MeetingContext, cid)
    return row.content if row else ""


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
    profile_data = {}
    if body.channel == "google_meet_live":
        profile = db.get(Profile, uid)
        profile_data = profile.data if profile else {}
    introduction = (
        owner_introduction(profile_data)
        if body.channel == "google_meet_live"
        else "Hello. I am an AI representative. My owner reviews every proposed response before it is shared."
    )
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
            {"role": "assistant", "content": introduction}
        ],
    )
    db.add(row)
    if body.channel == "google_meet_live":
        now = int(time.time())
        db.add(
            MeetingContext(
                conversation_id=row.id,
                user_id=uid,
                content=body.meeting_context.strip(),
                created_at=now,
                updated_at=now,
            )
        )
    db.commit()
    return {"id": row.id, "introduction": introduction}


@router.put("/api/conversations/{cid}/context")
def update_meeting_context(
    cid: str,
    body: MeetingContextInput,
    uid=Depends(account),
    db: Session = Depends(database),
):
    row = owned_conversation(cid, uid, db)
    if row.channel != "google_meet_live" or row.status not in {"listening", "live"}:
        raise HTTPException(409, "Meeting context can only change in an active meeting")
    context = db.get(MeetingContext, cid)
    if not context:
        now = int(time.time())
        context = MeetingContext(
            conversation_id=cid,
            user_id=uid,
            content="",
            created_at=now,
            updated_at=now,
        )
        db.add(context)
    context.content = body.content.strip()
    context.updated_at = int(time.time())
    db.commit()
    return {"updated_at": context.updated_at}


async def process_live_audio(
    websocket, session_data, db_call, audio, stopped, received_at
):
    received_at = received_at or time.perf_counter()
    processed_at = time.perf_counter()
    transcript_received_at = None
    reason_started_at = None
    reason_completed_at = None
    first_token_at = None
    try:
        wav = validate_live_wav(audio)
        await websocket.send_json({"type": "status", "status": "transcribing"})
        transcript = (await gnani.transcribe(wav)).strip()
        transcript_received_at = time.perf_counter()
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
        terms = set(transcript.lower().split())
        relevant = [
            memory
            for memory in session_data["context"]["memories"]
            if terms & set(memory.lower().split())
        ][:5]
        reason_context = {
            "owner": session_data["context"]["owner"],
            "profile": session_data["context"]["profile"],
            "meeting_context": session_data["context"]["meeting_context"],
            "memories": relevant,
            "history": session_data["transcript"][-12:],
            "question": transcript,
            "channel": session_data["channel"],
        }
        reason_started_at = time.perf_counter()

        def on_first_token():
            nonlocal first_token_at
            if first_token_at is None:
                first_token_at = time.perf_counter()

        reply = await reason(reason_context, on_first_token=on_first_token)
        reason_completed_at = time.perf_counter()
        if stopped.is_set() or not session_data["active"]:
            return

        response_text = reply.response_text
        if len(response_text) > 1000:
            raise HTTPException(
                422, "The generated reply is too long to speak in a live meeting"
            )
        await websocket.send_json({"type": "status", "status": "speaking"})
        synthesis_started_at = time.perf_counter()
        speech = await gnani.synthesize(
            response_text, session_data["voice_embedding"]
        )
        synthesis_completed_at = time.perf_counter()
        if stopped.is_set() or not session_data["active"]:
            return

        await websocket.send_json(
            {"type": "reply", "text": response_text, "transcript": transcript}
        )
        await websocket.send_json({"type": "audio", "mime": "audio/wav"})
        await websocket.send_bytes(speech)
        audio_delivered_at = time.perf_counter()
        session_data["transcript"] = session_data["transcript"] + [
            {"role": "user", "content": transcript},
            {"role": "assistant", "content": response_text},
        ]
        if not await db_call(
            persist_live_transcript,
            session_data["id"],
            session_data["transcript"],
        ):
            logger.warning(
                "Could not persist live transcript for conversation %s",
                session_data["id"],
            )
        logger.info(
            "live_turn_timing conversation_id=%s queue_ms=%.1f stt_ms=%.1f "
            "transcript_to_llm_ms=%.1f llm_to_first_token_ms=%s "
            "llm_total_ms=%.1f first_token_to_tts_start_ms=%s tts_ms=%.1f "
            "transcript_to_first_audio_ms=%.1f first_token_to_first_audio_ms=%s "
            "total_ms=%.1f",
            session_data["id"],
            (processed_at - received_at) * 1000,
            (transcript_received_at - processed_at) * 1000,
            (reason_started_at - transcript_received_at) * 1000,
            (
                f"{(first_token_at - reason_started_at) * 1000:.1f}"
                if first_token_at is not None
                else "unavailable"
            ),
            (reason_completed_at - reason_started_at) * 1000,
            (
                f"{(synthesis_started_at - first_token_at) * 1000:.1f}"
                if first_token_at is not None
                else "unavailable"
            ),
            (synthesis_completed_at - synthesis_started_at) * 1000,
            (audio_delivered_at - transcript_received_at) * 1000,
            (
                f"{(audio_delivered_at - first_token_at) * 1000:.1f}"
                if first_token_at is not None
                else "unavailable"
            ),
            (audio_delivered_at - received_at) * 1000,
        )
    except HTTPException as exc:
        await websocket.send_json({"type": "error", "message": exc.detail})
    except Exception:
        logger.exception("Unexpected live-meeting turn failure")
        await websocket.send_json(
            {"type": "error", "message": "Live response failed; check the backend logs"}
        )
    finally:
        if not stopped.is_set() and session_data["active"]:
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
    session_data = await run_in_threadpool(load_live_session, db, cid, token)
    if not session_data:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    db_lock = asyncio.Lock()

    async def db_call(operation, *args):
        async with db_lock:
            return await run_in_threadpool(operation, db, *args)

    if not await db_call(update_live_status, cid, "live", "listening"):
        await websocket.send_json(
            {"type": "error", "message": "This meeting is not available to start"}
        )
        await websocket.close(code=1008)
        return

    stopped = asyncio.Event()
    queue = asyncio.Queue(maxsize=1)

    async def process_queue():
        while not stopped.is_set():
            queued = await queue.get()
            if queued is None:
                return
            audio, received_at = queued
            await process_live_audio(
                websocket,
                session_data,
                db_call,
                audio,
                stopped,
                received_at,
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
                    session_data["active"] = False
                    await db_call(update_live_status, cid, "completed", "live")
                    break
                if command == {"type": "refresh_context"}:
                    session_data["context"]["meeting_context"] = await db_call(
                        load_meeting_context, cid
                    )
                    await websocket.send_json(
                        {"type": "context_refreshed", "status": "ready"}
                    )
                    continue
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
            queue.put_nowait((audio, time.perf_counter()))
    except WebSocketDisconnect:
        pass
    finally:
        stopped.set()
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
        if session_data["active"]:
            session_data["active"] = False
            await db_call(update_live_status, cid, "listening", "live")
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
