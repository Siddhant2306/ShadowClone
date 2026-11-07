# Gnani integration

Verified 2026-11-07 against official pages:
- https://docs.gnani.ai/api/VC/voice-clone-embeddings
- https://docs.gnani.ai/api/VC/vc-inference
- https://docs.gnani.ai/api/STT/speech-to-text

Base: https://api.vachana.ai. Authentication: X-API-Key-ID header.
POST /api/v1/tts/voice-clone/embeddings: multipart audio_file; response data.voice_clone_embedding contains embedding, shape and dtype. Reference duration 5–30 seconds.
POST /stt/v3: multipart audio_file, model=prisma-v3.0, language_code=indic-auto. Successful response contains transcript. Maximum duration 30 seconds.
POST /api/v1/tts/inference: JSON text, speaker_embedding and audio_config. Returns binary WAV with the selected configuration.

The implemented app accepts mono 16-bit PCM WAV uploads, max 5 MB. Audio is not persisted locally. Embeddings stay server-side. Explicit consent is required; local revocation deletes the embedding. Provider-side deletion/retention is not implemented. Provider errors are surfaced without exposing response bodies or secrets. Streaming contracts remain unimplemented. Real requests have not been tested without credentials.
