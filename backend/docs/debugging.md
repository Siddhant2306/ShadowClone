# Following a request from browser to database and model

Restart the backend after updating `.env`. Detailed diagnostics are currently enabled
in your local configuration:

```env
DEBUG_LOGGING=true
DEBUG_LOG_CONTENT=true
```

The terminal and `backend/logs/debug.jsonl` receive JSON events. Each line is one
event with a UTC timestamp and `request_id`. HTTP responses expose that same ID in
`X-Request-ID`. A WebSocket connection retains one ID across its turns. AI calls
also have a `call_id` in their start, prompt, response, completion and Ollama usage
events. Startup logs use the ID `startup`.

From the project folder, watch new events in PowerShell:

```powershell
Get-Content .\backend\logs\debug.jsonl -Tail 30 -Wait
```

The log rotates at 10 MB and retains five backups. Logs are ignored by Git. Detailed
logs contain profile, memory and conversation text; keep them local. API keys,
passwords, authentication tokens, cookies, database credentials and voice embeddings
are redacted. Binary audio is represented by byte count, never audio contents.

## What each stage records

| Event | Meaning |
| --- | --- |
| `app.configured`, `app.routes.ready`, `lifespan.*` | Selected model, registered routes, startup/shutdown |
| `http.start`, `http.request.body` | Incoming method/path and redacted JSON body |
| `auth.*` | Origin/session accepted or rejected, authenticated user ID |
| `db.session.*` | Database session opened/closed |
| `db.query`, `db.query.complete` | Parameterized SQL, safe parameters, execution time and driver row count |
| `db.row.loaded` | Loaded ORM object fields, with secrets removed |
| `db.write.pending` | Object fields queued for insert/update/delete; these are not committed yet |
| `db.transaction.commit`, `db.transaction.rollback` | Whether the transaction was committed or rolled back |
| `audio.validated` | WAV size, duration and format |
| `voice.request`, `voice.response`, `voice.response.json` | Gnani endpoint, safe request data, response status/size/content and duration |
| `speech.transcribed`, `speech.cleaned` | Recognized speech and text prepared for synthesis |
| `websocket.*`, `live.*` | Audio arrival, transcript, turn boundaries, outgoing statuses/replies |
| `ai.start`, `ai.prompt`, `ai.request` | Context, full composed prompts and outgoing Ollama payload |
| `ai.usage` | Provider-reported input/output token counts, not estimates |
| `ai.response.raw`, `ai.complete` | Model output, validated reply and elapsed time |
| `http.response.body`, `http.end` | Redacted JSON response, status, route handler and duration |
| `*.error` | Failure type/status; unexpected HTTP/WS errors include file/function/line frames |

Shared middleware and database hooks cover every route and model without duplicating
logging in schema/model declaration files. SQL reads returning scalar values do not
produce ORM row events, but their query and any resulting API/AI content are logged.
SQL bulk updates appear under `db.query` rather than `db.write.pending`.
Authentication/voice SQL parameters are omitted as a group. JSON HTTP bodies larger
than 256 KiB and multipart bodies are omitted; audio validation/service events still
show the flow. Headers are not dumped. Debugging does not change response approvals
or business behavior.

## Token usage

Ollama's `prompt_eval_count` becomes `prompt_tokens`; `eval_count` becomes
`completion_tokens`. They appear when the final stream event arrives. Missing
counts are `null`, not zero. Interrupted/failed streams may never report usage.
There is no reliable historical reconstruction for requests made before this change.
The output limit is not actual usage, and Ollama token counts are not API charges.
Optional Anthropic usage events preserve the provider's start/delta usage fields;
those events must not be blindly added together as independent requests.

To inspect Ollama usage in the current log:

```powershell
Get-Content .\backend\logs\debug.jsonl |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object { $_.event -eq 'ai.usage' -and $_.provider -eq 'ollama' } |
  Select-Object time, request_id, call_id, prompt_tokens, completion_tokens
```

## Browser traces

Open Developer Tools → Console and enable **Verbose** messages. Filter on
`ShadowClone`. Localhost enables these metadata-only traces by default. They show
API requests/statuses/request IDs, disclosure playback, live capture, queued
utterances and incoming WebSocket data. Request/response content stays in backend
logs; browser traces do not dump credentials or audio.

```javascript
localStorage.setItem("shadow.debug", "false"); // stop browser traces
localStorage.setItem("shadow.debug", "true");  // enable browser traces
```

Set `DEBUG_LOG_CONTENT=false` to retain backend flow/timing/token metadata without
conversation contents. Set `DEBUG_LOGGING=false` to disable backend diagnostics.
Restart the backend after configuration changes. Existing log files are retained.
