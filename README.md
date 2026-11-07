# Run Shadow Clone foundation

Implemented: registration/login/logout, cookie sessions, owner-isolated profiles and confirmed memories, React interface and initial Alembic migration.

This is an incomplete foundation, not the requested end-to-end voice product. Voice, LLM, approvals, WebSockets and call/meeting simulation are not implemented.

## Local setup (PowerShell)
1. Start Docker Desktop, then run `docker compose up -d` from this directory.
2. Install Python requirements into `.venv`: `python -m pip --python .venv/Scripts/python.exe install -r backend/requirements.txt`.
3. In `backend`, run `../.venv/Scripts/python -m alembic upgrade head`.
4. In `backend`, run `../.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.
5. From the root, run `npm.cmd install --prefix frontend`, then `npm.cmd run dev --prefix frontend`.
6. Open http://localhost:5173. Register with a password of at least 12 characters.

The default database password is for local development only. Set DATABASE_URL and FRONTEND_URL as environment variables for other environments. COOKIE_SECURE=true is required behind production HTTPS. Deployment hardening and login rate limiting remain unfinished.

API schemas are available at http://127.0.0.1:8000/docs when the backend runs.

Tests: from backend run `../.venv/Scripts/python -m pytest -q`. Tests use isolated SQLite, not PostgreSQL.

## Update: voice and text conversations
PostgreSQL now uses 127.0.0.1:55432. All three migrations were applied successfully.
Copy backend/.env.example to backend/.env and set GNANI_API_KEY for voice. For reasoning set LLM_PROVIDER=anthropic, LLM_API_KEY and LLM_MODEL to a model available to your account. The backend loads .env when launched from backend.

Voice identity supports WAV upload, explicit consent, enrolment, test playback and local revocation. Conversations supports persisted text simulations for calls/meetings, proposed LLM replies, owner edits/approval/rejection and transcript deletion. Every reply requires approval. These are not actual phone or meeting integrations.

Live audio capture/streaming, configurable permissions, automatic summaries and full onboarding remain unfinished. Provider integrations require live validation. The earlier foundation-only description above is superseded by this update.
