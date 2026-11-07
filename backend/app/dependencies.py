"""Authentication dependency shared by protected routes."""

import hashlib
import time
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import database
from app.config import ALLOWED_ORIGINS
from app.models.auth import LoginSession


def validate_origin(request: Request):
    if request.headers.get("origin") not in ALLOWED_ORIGINS:
        raise HTTPException(403, "Invalid request origin")


def account(request: Request, db: Session = Depends(database)):
    if request.method != "GET":
        validate_origin(request)
    token = request.cookies.get("shadow_session", "")
    if not token:
        raise HTTPException(401, "Please sign in")
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not session or session.expires < time.time():
        raise HTTPException(401, "Please sign in")
    return session.user_id
