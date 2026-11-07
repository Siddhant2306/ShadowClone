import os

os.environ["DATABASE_URL"] = "sqlite://"
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session
from app.main import app
from app.database import Base, database

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
Base.metadata.create_all(engine)


def db():
    with Session(engine) as session:
        yield session


app.dependency_overrides[database] = db


def test_isolation_and_logout():
    a = TestClient(app, headers={"origin": "http://localhost:5173"})
    b = TestClient(app, headers={"origin": "http://localhost:5173"})
    for client, email in [(a, "a@example.com"), (b, "b@example.com")]:
        assert (
            client.post(
                "/api/auth/register",
                json={"email": email, "password": "long-password-123"},
            ).status_code
            == 200
        )
    data = dict(
        display_name="Alice",
        communication_style="Concise",
        preferred_languages="English",
        knowledge="",
        restricted_topics="",
    )
    assert a.put("/api/profile", json=data).status_code == 200
    assert b.get("/api/profile").json() is None
    memory = a.post(
        "/api/memories", json={"content": "I like tea", "category": "preference"}
    ).json()["id"]
    assert b.get("/api/memories").json() == []
    assert b.delete("/api/memories/" + memory).status_code == 404
    assert a.post("/api/logout").status_code == 200
    assert a.get("/api/me").status_code == 401
    assert (
        a.post(
            "/api/auth/login",
            json={"email": "a@example.com", "password": "long-password-123"},
        ).status_code
        == 200
    )
    assert a.get("/api/profile").json()["display_name"] == "Alice"


def test_origin():
    c = TestClient(app)
    assert (
        c.post(
            "/api/auth/login",
            json={"email": "a@example.com", "password": "long-password-123"},
        ).status_code
        == 403
    )


def test_conversation_approval_and_isolation(monkeypatch):
    from app.reasoning import Reply

    async def fake_reason(context):
        return Reply(
            response_text="A proposed reply",
            confidence=1,
            requires_approval=False,
            reason="test",
        )

    monkeypatch.setattr("app.routes.conversations.reason", fake_reason)
    a = TestClient(app, headers={"origin": "http://localhost:5173"})
    b = TestClient(app, headers={"origin": "http://localhost:5173"})
    for c, email in [(a, "convo@example.com"), (b, "other@example.com")]:
        assert (
            c.post(
                "/api/auth/register",
                json={"email": email, "password": "long-password-123"},
            ).status_code
            == 200
        )
    cid = a.post("/api/conversations", json={"channel": "simulated_call"}).json()["id"]
    assert (
        b.post(f"/api/conversations/{cid}/turn", json={"text": "Hi"}).status_code == 404
    )
    r = a.post(f"/api/conversations/{cid}/turn", json={"text": "Hi"})
    assert r.json()["status"] == "waiting_for_approval"
    assert (
        a.post(f"/api/conversations/{cid}/turn", json={"text": "Again"}).status_code
        == 409
    )
    assert (
        a.post(
            f"/api/conversations/{cid}/resolve",
            json={"approve": True, "text": "Approved edit"},
        ).status_code
        == 200
    )
    assert (
        a.get("/api/conversations").json()[0]["transcript"][-1]["content"]
        == "Approved edit"
    )
    assert (
        a.post(
            f"/api/conversations/{cid}/resolve",
            json={"approve": True, "text": "duplicate"},
        ).status_code
        == 409
    )
    assert a.post(f"/api/conversations/{cid}/end").status_code == 200
    assert (
        a.post(f"/api/conversations/{cid}/turn", json={"text": "Hi"}).status_code == 409
    )


def test_voice_validation():
    a = TestClient(app, headers={"origin": "http://localhost:5173"})
    a.post(
        "/api/auth/register",
        json={"email": "voice@example.com", "password": "long-password-123"},
    )
    assert (
        a.post(
            "/api/voice/enrol",
            data={"consent": "false"},
            files={"file": ("a.wav", b"bad", "audio/wav")},
        ).status_code
        == 422
    )
    assert (
        a.post(
            "/api/voice/enrol",
            data={"consent": "true"},
            files={"file": ("a.wav", b"bad", "audio/wav")},
        ).status_code
        == 422
    )
    assert a.post("/api/voice/test").status_code == 409


def test_loopback_origin_and_untrusted_origin():
    client = TestClient(app, headers={"origin": "http://127.0.0.1:5173"})
    assert (
        client.post(
            "/api/auth/register",
            json={"email": "loopback@example.com", "password": "long-password-123"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/logout", headers={"origin": "https://untrusted.example"}
        ).status_code
        == 403
    )
    assert TestClient(app).get("/api/me").status_code == 401
