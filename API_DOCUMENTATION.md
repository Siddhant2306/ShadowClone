# Implemented API

Interactive schemas: /docs on the running FastAPI backend.

POST /api/auth/register and /api/auth/login: email/password JSON; issues HttpOnly session cookie.
POST /api/logout: revokes session.
GET /api/me: authenticated email.
GET /api/profile and PUT /api/profile: account-owned structured profile.
GET /api/memories and POST /api/memories: list/create confirmed memories.
DELETE /api/memories/{id}: owner-only deletion.
GET /api/health: process status and explicit unavailable voice/reasoning status.
POST /api/conversations: creates an owner-scoped conversation. The `google_meet_live` channel additionally requires `participants_consented: true` and an enrolled voice.
POST /api/conversations/{id}/speech: returns the enrolled voice audio for the current assistant message.
WebSocket /api/conversations/{id}/live: authenticated live-meeting session. Sends bounded mono PCM WAV utterances; replies are returned as JSON events followed by a WAV binary frame. Send `{"type":"stop"}` to end the session.

Mutations require the configured FRONTEND_URL Origin header. WebSocket connections also validate the Origin and authenticated HttpOnly session cookie. Missing authentication returns 401 for HTTP and closes the WebSocket with policy code 1008; inaccessible resources return 404 for HTTP. Meeting audio is processed in memory and is not stored; transcripts are persisted. Participant consent and the spoken AI disclosure are required for live sessions.
