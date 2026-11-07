from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import database
from app.dependencies import account, validate_origin
import hashlib
import os
import secrets
import time
from typing import Literal
from fastapi import Request, Response
from pwdlib import PasswordHash
from sqlalchemy import select
from app.models.auth import User, LoginSession
from app.schemas.auth import Credentials

passwords = PasswordHash.recommended()

router = APIRouter(tags=["auth"])


@router.post("/api/auth/{action}")
def authenticate(
    action: Literal["register", "login"],
    body: Credentials,
    request: Request,
    response: Response,
    db: Session = Depends(database),
):
    validate_origin(request)
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


@router.post("/api/logout")
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


@router.get("/api/me")
def me(uid=Depends(account), db: Session = Depends(database)):
    return {"email": db.get(User, uid).email}
