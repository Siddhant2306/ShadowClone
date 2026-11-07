from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import database
from app.dependencies import account
import secrets
from sqlalchemy import select
from app.models.memory import Memory
from app.schemas.memory import MemoryInput

router = APIRouter(tags=["memories"])


@router.get("/api/memories")
def memories(uid=Depends(account), db: Session = Depends(database)):
    return [
        {"id": m.id, "content": m.content, "category": m.category, "source": m.source}
        for m in db.scalars(select(Memory).where(Memory.user_id == uid))
    ]


@router.post("/api/memories")
def add_memory(
    body: MemoryInput, uid=Depends(account), db: Session = Depends(database)
):
    row = Memory(id=secrets.token_hex(16), user_id=uid, **body.model_dump())
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.delete("/api/memories/{memory_id}")
def delete_memory(
    memory_id: str, uid=Depends(account), db: Session = Depends(database)
):
    row = db.get(Memory, memory_id)
    if not row or row.user_id != uid:
        raise HTTPException(404, "Memory not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
