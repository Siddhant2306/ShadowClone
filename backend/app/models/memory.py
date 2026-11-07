from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Memory(Base):
    __tablename__ = "memories"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str]
    category: Mapped[str]
    source: Mapped[str] = mapped_column(default="user_confirmed")
