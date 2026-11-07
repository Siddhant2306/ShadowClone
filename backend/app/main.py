import hashlib
import os
import secrets
import time
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from sqlalchemy import JSON, ForeignKey, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from dotenv import load_dotenv

load_dotenv()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str]


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    expires: Mapped[int]


class Profile(Base):
    __tablename__ = "shadow_profiles"
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    data: Mapped[dict] = mapped_column(JSON)


class Memory(Base):
    __tablename__ = "memories"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str]
    category: Mapped[str]
    source: Mapped[str] = mapped_column(default="user_confirmed")


engine = create_engine(
    os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://shadow:shadow@127.0.0.1:55432/shadow?connect_timeout=5",
    )
)
passwords = PasswordHash.recommended()
app = FastAPI(title="Shadow Clone")
origin = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


def database():
    with Session(engine) as session:
        yield session


def account(request: Request, db: Session = Depends(database)):
    if request.method != "GET" and request.headers.get("origin") != origin:
        raise HTTPException(403, "Invalid request origin")
    token = request.cookies.get("shadow_session", "")
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not session or session.expires < time.time():
        raise HTTPException(401, "Please sign in")
    return session.user_id


class Credentials(BaseModel):
    email: str = Field(
        min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    )
    password: str = Field(min_length=12, max_length=128)


@app.post("/api/auth/{action}")
def authenticate(
    action: Literal["register", "login"],
    body: Credentials,
    request: Request,
    response: Response,
    db: Session = Depends(database),
):
    if request.headers.get("origin") != origin:
        raise HTTPException(403, "Invalid request origin")
    email = body.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if action == "register":
        if user:
            raise HTTPException(409, "Account already exists")
        user = User(
            id=secrets.token_hex(16),
            email=email,
            password_hash=passwords.hash(body.password),
        )
        db.add(user)
        db.flush()
    elif not user or not passwords.verify(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    token = secrets.token_urlsafe(32)
    db.add(
        LoginSession(
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            user_id=user.id,
            expires=int(time.time()) + 86400,
        )
    )
    db.commit()
    response.set_cookie(
        "shadow_session",
        token,
        httponly=True,
        samesite="strict",
        secure=os.getenv("COOKIE_SECURE", "false") == "true",
        max_age=86400,
    )
    return {"email": user.email}


@app.post("/api/logout")
def logout(
    request: Request,
    response: Response,
    uid=Depends(account),
    db: Session = Depends(database),
):
    row = db.get(
        LoginSession,
        hashlib.sha256(request.cookies["shadow_session"].encode()).hexdigest(),
    )
    db.delete(row)
    db.commit()
    response.delete_cookie("shadow_session")
    return {"ok": True}


@app.get("/api/me")
def me(uid=Depends(account), db: Session = Depends(database)):
    return {"email": db.get(User, uid).email}


class ProfileInput(BaseModel):
    display_name: str = Field(max_length=100)
    communication_style: str = Field(max_length=2000)
    preferred_languages: str = Field(max_length=200)
    knowledge: str = Field(max_length=4000)
    restricted_topics: str = Field(max_length=2000)


@app.get("/api/profile")
def get_profile(uid=Depends(account), db: Session = Depends(database)):
    row = db.get(Profile, uid)
    return row.data if row else None


@app.put("/api/profile")
def save_profile(
    body: ProfileInput, uid=Depends(account), db: Session = Depends(database)
):
    db.merge(Profile(user_id=uid, data=body.model_dump()))
    db.commit()
    return body


class MemoryInput(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    category: Literal["personal_fact", "preference", "knowledge", "decision"]


@app.get("/api/memories")
def memories(uid=Depends(account), db: Session = Depends(database)):
    return [
        {"id": m.id, "content": m.content, "category": m.category, "source": m.source}
        for m in db.scalars(select(Memory).where(Memory.user_id == uid))
    ]


@app.post("/api/memories")
def add_memory(
    body: MemoryInput, uid=Depends(account), db: Session = Depends(database)
):
    row = Memory(id=secrets.token_hex(16), user_id=uid, **body.model_dump())
    db.add(row)
    db.commit()
    return {"id": row.id}


@app.delete("/api/memories/{memory_id}")
def delete_memory(
    memory_id: str, uid=Depends(account), db: Session = Depends(database)
):
    row = db.get(Memory, memory_id)
    if not row or row.user_id != uid:
        raise HTTPException(404, "Memory not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@app.get("/api/health")
def health():
    return {
        "status": "running",
        "voice": "configured" if os.getenv("GNANI_API_KEY") else "needs_api_key",
        "reasoning": "not_implemented",
    }


class Voice(Base):
    __tablename__ = "voice_profiles"
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    embedding: Mapped[dict] = mapped_column(JSON)
    consent_at: Mapped[int]


from fastapi import UploadFile, File, Form
from app import gnani
import io
import wave


async def wav_audio(file: UploadFile, minimum=0.2):
    data = await file.read(3_000_001)
    if len(data) > 3_000_000:
        raise HTTPException(413, "Audio exceeds 3 MB")
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
        raise HTTPException(422, f"Use mono 16-bit PCM WAV, {minimum}–30 seconds")
    return data


@app.get("/api/voice")
def voice_status(uid=Depends(account), db: Session = Depends(database)):
    return {
        "status": "ready" if db.get(Voice, uid) else "not_started",
        "configured": bool(os.getenv("GNANI_API_KEY")),
    }


@app.post("/api/voice/enrol")
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


@app.delete("/api/voice")
def revoke_voice(uid=Depends(account), db: Session = Depends(database)):
    row = db.get(Voice, uid)
    if row:
        db.delete(row)
        db.commit()
    return {"status": "revoked"}


@app.post("/api/voice/test")
async def test_voice(uid=Depends(account), db: Session = Depends(database)):
    row = db.get(Voice, uid)
    if not row:
        raise HTTPException(409, "Enrol your voice first")
    data = await gnani.synthesize(
        "Hello. I am an AI voice representative, speaking with the consent of my owner.",
        row.embedding,
    )
    return Response(data, media_type="audio/wav")


@app.post("/api/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...), uid=Depends(account)):
    return {"transcript": await gnani.transcribe(await wav_audio(file))}


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[str]
    status: Mapped[str]
    transcript: Mapped[list] = mapped_column(JSON)
    started_at: Mapped[int]


class TurnInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class ChannelInput(BaseModel):
    channel: Literal["simulated_call", "simulated_meeting"]


@app.post("/api/conversations")
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


@app.get("/api/conversations")
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


from app.reasoning import reason


@app.post("/api/conversations/{cid}/turn")
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


class Resolution(BaseModel):
    approve: bool
    text: str = Field(max_length=3000)


@app.post("/api/conversations/{cid}/resolve")
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


@app.post("/api/conversations/{cid}/end")
def end_conversation(cid: str, uid=Depends(account), db: Session = Depends(database)):
    row = owned_conversation(cid, uid, db)
    row.status = "completed"
    db.commit()
    return {"status": row.status}


@app.delete("/api/conversations/{cid}")
def delete_conversation(
    cid: str, uid=Depends(account), db: Session = Depends(database)
):
    db.delete(owned_conversation(cid, uid, db))
    db.commit()
    return {"ok": True}
