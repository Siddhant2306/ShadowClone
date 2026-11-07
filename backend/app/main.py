"""FastAPI application setup and route registration."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import ALLOWED_ORIGINS
from app.routes import auth, profile, memories, voice, conversations, health

app = FastAPI(title="Shadow Clone")
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

for router in (
    auth.router,
    profile.router,
    memories.router,
    voice.router,
    conversations.router,
    health.router,
):
    app.include_router(router)
