# Architecture

React browser application communicates with a modular FastAPI backend over HTTP and authenticated WebSockets. PostgreSQL stores account-owned records; Alembic owns schema evolution. Audio is processed outside database storage.

One conversation orchestrator serves simulated call and meeting channels. It coordinates transcription, context retrieval, structured LLM reasoning, deterministic permission checks, owner approval and synthesis. Backend state transitions are authoritative.

Provider adapters isolate Gnani, the configurable LLM, telephony and meeting providers. Missing configuration returns explicit unavailable errors. Consent is required before enrolment; revocation prevents subsequent synthesis. Participants receive AI disclosure.

Authentication must include password hashing, session revocation, ownership checks and origin validation. Approval decisions must be atomic and time bounded. Unverified memories cannot become confirmed personal facts automatically.
