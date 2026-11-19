"""Shared SQLAlchemy engine, base and request-scoped sessions."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session
from app.config import DATABASE_URL
from app.database_debug import install_database_debug
from app.diagnostics import emit

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
install_database_debug(engine)


class Base(DeclarativeBase):
    pass


def database():
    emit("db.session.open")
    try:
        with Session(engine) as session:
            yield session
    finally:
        emit("db.session.close")
