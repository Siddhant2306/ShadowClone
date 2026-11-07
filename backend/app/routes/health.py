from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import database
from app.dependencies import account
import os

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health():
    return {
        "status": "running",
        "voice": "configured" if os.getenv("GNANI_API_KEY") else "needs_api_key",
        "reasoning": "not_implemented",
    }
