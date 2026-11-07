# Implemented API

Interactive schemas: /docs on the running FastAPI backend.

POST /api/auth/register and /api/auth/login: email/password JSON; issues HttpOnly session cookie.
POST /api/logout: revokes session.
GET /api/me: authenticated email.
GET /api/profile and PUT /api/profile: account-owned structured profile.
GET /api/memories and POST /api/memories: list/create confirmed memories.
DELETE /api/memories/{id}: owner-only deletion.
GET /api/health: process status and explicit unavailable voice/reasoning status.

Mutations require the configured FRONTEND_URL Origin header. Credentials are cookie-based. Missing authentication returns 401; inaccessible memory returns 404. Other planned APIs are not implemented.
