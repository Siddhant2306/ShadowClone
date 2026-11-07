from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import database
from app.dependencies import account
from app.models.profile import Profile
from app.schemas.profile import ProfileInput

router = APIRouter(tags=["profile"])


@router.get("/api/profile")
def get_profile(uid=Depends(account), db: Session = Depends(database)):
    row = db.get(Profile, uid)
    return row.data if row else None


@router.put("/api/profile")
def save_profile(
    body: ProfileInput, uid=Depends(account), db: Session = Depends(database)
):
    db.merge(Profile(user_id=uid, data=body.model_dump()))
    db.commit()
    return body
