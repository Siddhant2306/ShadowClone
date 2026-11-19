"""Structured, correlated diagnostics shared by routes, services and database hooks."""

import contextvars
import json
import logging
import os
import re
import time
import traceback
import uuid
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

request_id = contextvars.ContextVar("request_id", default="startup")
logger = logging.getLogger("shadow.debug")
SECRET_FIELDS = (
    "password",
    "token",
    "cookie",
    "authorization",
    "api_key",
    "embedding",
    "database_url",
)


def enabled():
    return os.getenv("DEBUG_LOGGING", "false").lower() == "true"


def error_frames(exc):
    return [
        {"file": frame.filename, "line": frame.lineno, "function": frame.name}
        for frame in traceback.extract_tb(exc.__traceback__)
    ]


def clean(value, key=""):
    # Token usage counters are safe; authentication tokens are not.
    usage_keys = {
        "input_tokens",
        "output_tokens",
        "cache_read_input_tokens",
        "cache_creation_input_tokens",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "reasoning_tokens",
        "prompt_cache_hit_tokens",
        "prompt_cache_miss_tokens",
        "max_tokens",
        "num_predict",
    }
    if key not in usage_keys and any(word in key.lower() for word in SECRET_FIELDS):
        return "[REDACTED]"
    if isinstance(value, dict):
        # Validation errors may contain passwords in their input field.
        if any("password" in str(part).lower() for part in (value.get("loc") or [])):
            return {"loc": value["loc"], "detail": "[REDACTED validation input]"}
        return {str(k): clean(v, str(k)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(item) for item in value]
    if isinstance(value, bytes):
        return {"bytes": len(value), "content": "[binary omitted]"}
    if isinstance(value, str):
        if value.lstrip().startswith(("{", "[")):
            try:
                return clean(json.loads(value))
            except ValueError:
                pass
        for name, secret in os.environ.items():
            if len(secret) >= 8 and any(word in name.lower() for word in SECRET_FIELDS):
                value = value.replace(secret, "[REDACTED]")
        return re.sub(r"(\w+://)[^\s/@]+:[^\s/@]+@", r"\1[REDACTED]@", value)
    if value is None or isinstance(value, (int, float, bool)):
        return value
    return f"<{type(value).__name__}>"


def emit(event, *, content=None, **fields):
    if not enabled():
        return
    record = {
        "time": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "request_id": request_id.get(),
        **fields,
    }
    if content is not None:
        record["content"] = (
            clean(content)
            if os.getenv("DEBUG_LOG_CONTENT", "false").lower() == "true"
            else "[content logging disabled]"
        )
    logger.info(json.dumps(clean(record), ensure_ascii=False, default=str))


def configure():
    if not enabled() or logger.handlers:
        return
    logger.setLevel(logging.INFO)
    logger.propagate = False
    formatter = logging.Formatter("%(message)s")
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)
    directory = Path(__file__).resolve().parents[1] / "logs"
    try:
        directory.mkdir(exist_ok=True)
        handler = RotatingFileHandler(
            directory / "debug.jsonl",
            maxBytes=10_000_000,
            backupCount=5,
            encoding="utf-8",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    except OSError:
        emit("logging.file_unavailable")
    emit(
        "app.configured",
        provider=os.getenv("LLM_PROVIDER"),
        model=os.getenv("LLM_MODEL"),
        content_logging=os.getenv("DEBUG_LOG_CONTENT", "false"),
    )


class TraceMiddleware:
    """Observe ASGI messages without consuming request bodies or changing streams."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if enabled() and scope["type"] == "lifespan":

            async def lifespan_send(message):
                emit(message["type"])
                await send(message)

            return await self.app(scope, receive, lifespan_send)
        if not enabled() or scope["type"] not in {"http", "websocket"}:
            return await self.app(scope, receive, send)
        correlation = uuid.uuid4().hex
        token = request_id.set(correlation)
        started = time.perf_counter()
        protocol = scope["type"]
        headers = dict(scope.get("headers", []))
        json_request = b"application/json" in headers.get(b"content-type", b"")
        buffers = {"request": bytearray(), "response": bytearray()}
        sizes = {"request": 0, "response": 0}
        response_json = False
        status = None
        emit(f"{protocol}.start", path=scope["path"], method=scope.get("method"))

        def body_event(direction, data, is_json, final):
            sizes[direction] += len(data)
            if is_json and len(buffers[direction]) < 262144:
                buffers[direction].extend(data[: 262144 - len(buffers[direction])])
            if final:
                payload = None
                if is_json and sizes[direction] <= 262144:
                    try:
                        payload = json.loads(buffers[direction])
                    except (ValueError, UnicodeDecodeError):
                        payload = "[invalid JSON omitted]"
                emit(
                    f"http.{direction}.body",
                    bytes=sizes[direction],
                    content=payload,
                    omitted=not is_json or sizes[direction] > 262144,
                )

        async def traced_receive():
            message = await receive()
            if message["type"] == "http.request":
                body_event(
                    "request",
                    message.get("body", b""),
                    json_request,
                    not message.get("more_body"),
                )
            elif message["type"].startswith("websocket."):
                emit(
                    message["type"],
                    bytes=len(message.get("bytes") or b""),
                    content=message.get("text"),
                )
            return message

        async def traced_send(message):
            nonlocal response_json, status
            if message["type"] == "http.response.start":
                status = message["status"]
                response_json = b"application/json" in dict(
                    message.get("headers", [])
                ).get(b"content-type", b"")
                message = {
                    **message,
                    "headers": list(message.get("headers", []))
                    + [(b"x-request-id", correlation.encode())],
                }
            elif message["type"] == "http.response.body":
                body_event(
                    "response",
                    message.get("body", b""),
                    response_json,
                    not message.get("more_body"),
                )
            elif message["type"].startswith("websocket."):
                payload = message.get("text")
                if payload:
                    try:
                        payload = json.loads(payload)
                    except ValueError:
                        pass
                emit(
                    message["type"],
                    bytes=len(message.get("bytes") or b""),
                    content=payload,
                    code=message.get("code"),
                )
            await send(message)

        try:
            await self.app(scope, traced_receive, traced_send)
        except Exception as exc:
            emit(
                f"{protocol}.error",
                error_type=type(exc).__name__,
                frames=error_frames(exc),
            )
            raise
        finally:
            emit(
                f"{protocol}.end",
                status=status,
                handler=getattr(scope.get("endpoint"), "__qualname__", None),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            request_id.reset(token)
