"""Environment configuration loaded before database initialization."""

import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("Set DATABASE_URL to your Supabase PostgreSQL URL in backend/.env")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOWED_ORIGINS = {FRONTEND_URL.rstrip("/")}
_frontend = urlsplit(FRONTEND_URL)
if _frontend.hostname in {"localhost", "127.0.0.1"}:
    for _host in ("localhost", "127.0.0.1"):
        _netloc = f"{_host}:{_frontend.port}" if _frontend.port else _host
        ALLOWED_ORIGINS.add(urlunsplit((_frontend.scheme, _netloc, "", "", "")))
