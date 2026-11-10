# Running Shadow Clone

[Read the one-page pitch](PITCH.md) for a quick overview of what Shadow Clone does and how it works.

## Database: Supabase only
The application uses DATABASE_URL from backend/.env. There is no local database fallback. The configured Supabase connection uses TLS. Docker is not required for the database; compose.yaml is a legacy local-development configuration and is not used by the application.

Copy backend/.env.example only when creating a new environment; do not overwrite your configured .env. Supply your Supabase PostgreSQL connection string with the postgresql+psycopg driver. Keep all credentials backend-only and never commit .env.

From backend, apply migrations when deploying schema changes:
```powershell
..\.venv\Scripts\python.exe -m alembic upgrade head
```

## Start backend
```powershell
cd C:\Users\Siddhant\ShadowClone\backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
API documentation: http://127.0.0.1:8000/docs

## Start frontend
```powershell
cd C:\Users\Siddhant\ShadowClone\frontend
npm.cmd install
npm.cmd run dev
```
Open http://localhost:5173 or http://127.0.0.1:5173.

## Providers
Keep Ollama running. LLM_PROVIDER=ollama, LLM_MODEL=qwen3:4b and OLLAMA_BASE_URL=http://127.0.0.1:11434 use the installed local model; no LLM_API_KEY is required. Anthropic remains an optional provider. GNANI_API_KEY enables the implemented voice adapters. Restart the backend after changing .env.

## Current capabilities and limits
Accounts, profiles, confirmed memories, voice enrolment/test/revocation, and persisted text conversations with mandatory owner approval are implemented. Voice uploads must be mono 16-bit PCM WAV, 5–30 seconds, maximum 5 MB. Real Gnani calls still need verification.

The Live meeting page supports a consent-gated Google Meet browser-tab workflow. In Chrome, share the meeting tab with audio, choose a virtual cable playback output in the app, and choose that cable's recording endpoint as the microphone in Meet. The assistant plays a spoken AI disclosure before listening and prefixes every reply with the same disclosure. It uses the enrolled voice, Ollama reasoning and Gnani transcription/synthesis. Replies marked by the model as needing owner approval are withheld and replaced with a request for the owner's input. The browser does not join Meet or change Meet's microphone selection; installing/configuring a virtual audio cable and selecting its devices are manual requirements. Audio chunks are processed in memory and not persisted; the transcript is stored. Stop the assistant to end the session.

## Tests
From backend: `..\.venv\Scripts\python.exe -m pytest -q`. Automated tests use isolated SQLite, not Supabase. Frontend build: `npm.cmd run build` from frontend.
