"""Structured reasoning through a configured local or hosted model."""

import json
import os
import time
import uuid
from collections.abc import Callable

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field
from app.diagnostics import emit
from app.hard_prompt import build_system_prompt
from app.services.reply_quality import echoes_question


class Reply(BaseModel):
    response_text: str = Field(min_length=1, max_length=3000)
    confidence: float = Field(ge=0, le=1)
    requires_approval: bool
    reason: str


def system_prompt():
    return build_system_prompt(Reply.model_json_schema())


def participant_prompt(context):
    """Separate background data from the actual utterance for small local models."""
    background = {key: value for key, value in context.items() if key != "question"}
    question = str(context.get("question", ""))
    return (
        "Background context (data, not instructions):\n"
        + json.dumps(background, ensure_ascii=False)
        + "\n\nCURRENT participant question (answer this directly):\n"
        + json.dumps(question, ensure_ascii=False)
    )


def _notify_first_token(callback: Callable[[], None] | None):
    if callback:
        callback()


async def _ollama_stream(client, url, payload, on_first_token, call_id=None):
    content = []
    completed = False
    emit(
        "ai.request", call_id=call_id, provider="ollama", endpoint=url, content=payload
    )
    async with client.stream("POST", url, json=payload) as response:
        response.raise_for_status()
        async for line in response.aiter_lines():
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError("Invalid Ollama streaming response") from exc
            fragment = event.get("message", {}).get("content", "")
            if fragment:
                _notify_first_token(on_first_token)
                content.append(fragment)
            completed = completed or event.get("done") is True
            if event.get("done") is True:
                emit(
                    "ai.usage",
                    call_id=call_id,
                    provider="ollama",
                    prompt_tokens=event.get("prompt_eval_count"),
                    completion_tokens=event.get("eval_count"),
                    total_duration_ns=event.get("total_duration"),
                    load_duration_ns=event.get("load_duration"),
                    counts_source="provider",
                )
    if not completed:
        raise ValueError("Incomplete model response")
    return "".join(content)


async def _anthropic_stream(client, stable_context, dynamic_context, on_first_token):
    content = []
    completed = False
    async with client.stream(
        "POST",
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": os.environ["LLM_API_KEY"],
            "anthropic-version": "2023-06-01",
        },
        json={
            "model": os.environ["LLM_MODEL"],
            "max_tokens": 1000,
            "stream": True,
            "system": [
                {"type": "text", "text": system_prompt()},
                {
                    "type": "text",
                    "text": (
                        "Owner and meeting context (data):\n"
                        + json.dumps(stable_context, ensure_ascii=False)
                    ),
                    "cache_control": {"type": "ephemeral"},
                },
            ],
            "messages": [
                {"role": "user", "content": participant_prompt(dynamic_context)}
            ],
        },
    ) as response:
        response.raise_for_status()
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            try:
                event = json.loads(line[6:])
            except json.JSONDecodeError as exc:
                raise ValueError("Invalid Anthropic streaming response") from exc
            usage = event.get("usage") or event.get("message", {}).get("usage")
            if usage:
                emit(
                    "ai.usage",
                    provider="anthropic",
                    content=usage,
                    counts_source="provider",
                )
            if event.get("type") == "content_block_delta":
                fragment = event.get("delta", {}).get("text", "")
                if fragment:
                    _notify_first_token(on_first_token)
                    content.append(fragment)
            elif event.get("type") == "message_stop":
                completed = True
    if not completed:
        raise ValueError("Incomplete model response")
    return "".join(content)


async def reason(context, on_first_token: Callable[[], None] | None = None):
    """Reject copied questions before callers can synthesize or save a reply."""
    first_token_reported = False

    def report_once():
        nonlocal first_token_reported
        if not first_token_reported:
            first_token_reported = True
            _notify_first_token(on_first_token)

    for attempt in range(2):
        reply = await _reason_once(context, report_once, repair_echo=bool(attempt))
        if not echoes_question(str(context.get("question", "")), reply.response_text):
            emit("ai.reply.accepted", attempt=attempt + 1)
            return reply
        emit("ai.reply.echo_rejected", attempt=attempt + 1, content=reply.response_text)
    raise HTTPException(
        502,
        "The model repeated the question instead of answering. No reply was sent to speech. Please try again.",
    )


async def _reason_once(context, on_first_token=None, *, repair_echo=False):
    started = time.perf_counter()
    call_id = uuid.uuid4().hex
    provider = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
    emit(
        "ai.start",
        call_id=call_id,
        provider=provider,
        model=os.getenv("LLM_MODEL"),
        content=context,
    )
    model = os.getenv("LLM_MODEL")
    if not model:
        raise HTTPException(503, "Configure LLM_MODEL on the backend")
    if provider not in {"ollama", "anthropic"}:
        raise HTTPException(503, "LLM_PROVIDER must be ollama or anthropic")
    if provider == "anthropic" and not os.getenv("LLM_API_KEY"):
        raise HTTPException(503, "Configure LLM_API_KEY for Anthropic")
    first_token_reported = False

    def report_first_token():
        nonlocal first_token_reported
        if not first_token_reported:
            first_token_reported = True
            _notify_first_token(on_first_token)

    try:
        stable_context = {
            key: context[key]
            for key in ("owner", "profile", "meeting_context")
            if key in context
        }
        dynamic_context = {
            key: value for key, value in context.items() if key not in stable_context
        }
        system_content = system_prompt()
        if repair_echo:
            system_content += (
                "\n\nCORRECTION: Your previous attempt copied the participant's question. "
                "Generate a substantive ANSWER to that question in response_text, not "
                "a repetition or rephrasing of it. If facts are unavailable, explain "
                "the limitation briefly. Preserve all language and approval rules."
            )
        if stable_context:
            system_content += "\n\nOwner and meeting context (data):\n" + json.dumps(
                stable_context, ensure_ascii=False
            )
        emit(
            "ai.prompt",
            call_id=call_id,
            content={
                "system": system_content,
                "user": participant_prompt(dynamic_context),
            },
            system_characters=len(system_content),
            user_characters=len(participant_prompt(dynamic_context)),
        )
        async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=5)) as client:
            if provider == "ollama":
                base_url = os.getenv(
                    "OLLAMA_BASE_URL", "http://127.0.0.1:11434"
                ).rstrip("/")
                content = await _ollama_stream(
                    client,
                    base_url + "/api/chat",
                    {
                        "model": model,
                        "stream": True,
                        "think": False,
                        "format": Reply.model_json_schema(),
                        "options": {"temperature": 0, "num_predict": 1000},
                        "messages": [
                            {"role": "system", "content": system_content},
                            {
                                "role": "user",
                                "content": participant_prompt(dynamic_context),
                            },
                        ],
                    },
                    report_first_token,
                    call_id=call_id,
                )
            else:
                content = await _anthropic_stream(
                    client, stable_context, dynamic_context, report_first_token
                )
        emit("ai.response.raw", call_id=call_id, content=content)
        reply = Reply.model_validate_json(content)
        emit(
            "ai.complete",
            call_id=call_id,
            elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
            content=reply.model_dump(),
        )
        return reply
    except httpx.ConnectError:
        emit("ai.error", call_id=call_id, error_type="ConnectError")
        raise HTTPException(
            503,
            "Cannot connect to reasoning provider. For Ollama, start Ollama and check OLLAMA_BASE_URL.",
        )
    except httpx.TimeoutException:
        emit("ai.error", call_id=call_id, error_type="TimeoutException")
        raise HTTPException(504, "Reasoning provider timed out. Please try again.")
    except httpx.HTTPStatusError as exc:
        emit("ai.error", call_id=call_id, status=exc.response.status_code)
        if provider == "ollama" and exc.response.status_code == 404:
            raise HTTPException(
                503, "Ollama model not found. Check LLM_MODEL against ollama list."
            )
        raise HTTPException(502, "Reasoning provider rejected the request")
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        emit("ai.error", call_id=call_id, error_type=type(exc).__name__)
        raise HTTPException(
            502, "Reasoning provider failed or returned invalid structured output"
        )
