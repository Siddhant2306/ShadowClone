"""Shared SQLAlchemy engine, base and request-scoped sessions."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session
from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


class Base(DeclarativeBase):
    pass


def database():
    with Session(engine) as session:
        yield session
