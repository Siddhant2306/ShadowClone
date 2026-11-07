# Shadow Clone implementation plan

Build incrementally and verify each phase before continuing.

1. Foundation: React/TypeScript/Vite, FastAPI, PostgreSQL, Alembic, authentication and ownership constraints.
2. Onboarding: profile questionnaire, review, audio recording and explicit voice consent.
3. Gnani: verify official REST and streaming contracts, implement enrolment, Prisma transcription and cloned synthesis.
4. Intelligence: configurable LLM, validated responses, relevant memory retrieval and deterministic permissions.
5. Conversation: authenticated WebSockets, authoritative state machine, audio queues and approval continuation.
6. Channels: clearly labelled simulated calls and meetings sharing one engine; external adapters.
7. Product: dashboard, history, approvals and settings.
8. Verification: migrations, backend tests, frontend build and documented real-provider validation.

Primary acceptance: consented enrolment followed by a browser audio conversation with persisted transcript and enforced approvals. Credentials must remain backend-only. No fake integration successes.
