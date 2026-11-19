import asyncio
import json

import httpx
import pytest
from fastapi import FastAPI, Request, WebSocket
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import diagnostics
from app.database import Base
from app.database_debug import install_database_debug
from app.models.auth import User
from app.reasoning import reason
from test_reasoning import FakeStream


@pytest.fixture
def records(monkeypatch):
    rows = []
    monkeypatch.setenv("DEBUG_LOGGING", "true")
    monkeypatch.setenv("DEBUG_LOG_CONTENT", "true")
    monkeypatch.setattr(
        diagnostics.logger, "info", lambda message: rows.append(json.loads(message))
    )
    return rows


def test_redacts_credentials_but_preserves_usage(monkeypatch, records):
    monkeypatch.setenv("GNANI_API_KEY", "secret-example-key")
    diagnostics.emit(
        "test",
        content={
            "password": "private",
            "token_hash": "private",
            "speaker_embedding": [1, 2],
            "nested": {"Authorization": "Bearer private"},
            "text": "secret-example-key",
            "prompt_tokens": 32,
            "input_tokens": 12,
            "validation": {"loc": ["body", "password"], "input": "private"},
        },
    )
    assert "private" not in json.dumps(records)
    assert "secret-example-key" not in json.dumps(records)
    assert records[0]["content"]["prompt_tokens"] == 32
    assert records[0]["content"]["input_tokens"] == 12


def test_http_body_not_consumed_and_id_correlated(records):
    app = FastAPI()
    app.add_middleware(diagnostics.TraceMiddleware)

    @app.post("/echo")
    async def echo(request: Request):
        return await request.json()

    response = TestClient(app).post(
        "/echo", json={"question": "Hello", "password": "hidden"}
    )
    assert response.json()["question"] == "Hello"
    assert "hidden" not in json.dumps(records)
    assert {r["request_id"] for r in records} == {response.headers["x-request-id"]}
    assert {r["event"] for r in records} >= {
        "http.start",
        "http.request.body",
        "http.response.body",
        "http.end",
    }


def test_content_can_be_disabled(monkeypatch, records):
    monkeypatch.setenv("DEBUG_LOG_CONTENT", "false")
    diagnostics.emit("test", content={"question": "private discussion"})
    assert "private discussion" not in json.dumps(records)
    monkeypatch.setenv("DEBUG_LOGGING", "false")
    diagnostics.emit("not recorded")
    assert len(records) == 1


def test_websocket_preserves_audio_without_logging_it(records):
    app = FastAPI()
    app.add_middleware(diagnostics.TraceMiddleware)

    @app.websocket("/live")
    async def live(socket: WebSocket):
        await socket.accept()
        data = await socket.receive_bytes()
        await socket.send_bytes(data)
        await socket.close()

    with TestClient(app).websocket_connect("/live") as socket:
        socket.send_bytes(b"private-audio-data")
        assert socket.receive_bytes() == b"private-audio-data"
    assert "private-audio-data" not in json.dumps(records)
    assert any(
        row["event"] == "websocket.receive" and row["bytes"] == 18 for row in records
    )


def test_database_writes_commit_and_redaction(records):
    engine = create_engine("sqlite://")
    install_database_debug(engine)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(
            User(
                id="debug-test", email="debug@example.com", password_hash="private-hash"
            )
        )
        session.commit()
    assert "private-hash" not in json.dumps(records)
    assert any(
        row["event"] == "db.write.pending" and row["table"] == "users"
        for row in records
    )
    assert any(row["event"] == "db.transaction.commit" for row in records)
    engine.dispose()


def test_ollama_reports_actual_token_counts(monkeypatch, records):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_MODEL", "qwen3:4b")
    output = json.dumps(
        {
            "response_text": "Hello",
            "confidence": 1,
            "requires_approval": False,
            "reason": "Greeting",
        }
    )
    lines = [
        json.dumps({"message": {"content": output}, "done": False}),
        json.dumps({"done": True, "prompt_eval_count": 812, "eval_count": 36}),
    ]
    monkeypatch.setattr(httpx.AsyncClient, "stream", lambda *a, **kw: FakeStream(lines))
    asyncio.run(reason({"question": "Hello"}))
    usage = next(row for row in records if row["event"] == "ai.usage")
    assert usage["prompt_tokens"] == 812
    assert usage["completion_tokens"] == 36
    assert usage["call_id"] == next(
        row["call_id"] for row in records if row["event"] == "ai.start"
    )
    assert any(row["event"] == "ai.prompt" for row in records)
