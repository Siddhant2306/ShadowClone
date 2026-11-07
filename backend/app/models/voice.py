from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Voice(Base):
    __tablename__ = "voice_profiles"
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    embedding: Mapped[dict] = mapped_column(JSON)
    consent_at: Mapped[int]
