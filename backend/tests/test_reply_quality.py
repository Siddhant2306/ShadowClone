import asyncio

import pytest
from fastapi import HTTPException

from app import reasoning
from app.services.reply_quality import echoes_question

QUESTION = "ओके, सो लाइक मेरे को कुछ और बताओ ए आई के बारे में, जो कि आजकल नया है और ट्रेंडिंग है?"


def reply(text):
    return reasoning.Reply(
        response_text=text, confidence=0.9, requires_approval=False, reason="Test"
    )


def test_catches_attached_echo_and_cosmetic_changes():
    assert echoes_question(QUESTION, QUESTION)
    assert echoes_question(QUESTION, QUESTION.replace("?", "।"))
    assert echoes_question(
        "Tell me about the newest tools for software development?",
        "Tell me about newest tools for software development.",
    )


def test_allows_greetings_and_substantive_answers():
    assert not echoes_question("Hello", "Hello!")
    assert not echoes_question("धन्यवाद", "धन्यवाद।")
    assert not echoes_question(
        QUESTION,
        "मेरे पास ताज़ा खबरों की पुष्टि करने की सुविधा नहीं है। मैं कृत्रिम बुद्धिमत्ता के प्रमुख उपयोगों के बारे में बता सकता हूँ।",
    )
    assert not echoes_question("What is the deadline?", "The deadline is Friday.")


def test_echo_retried_once(monkeypatch):
    attempts = []
    tokens = []

    async def generate(context, callback, *, repair_echo=False):
        attempts.append(repair_echo)
        callback()
        return reply("The deadline is Friday." if repair_echo else context["question"])

    monkeypatch.setattr(reasoning, "_reason_once", generate)
    result = asyncio.run(
        reasoning.reason(
            {"question": "What is the deadline?"}, lambda: tokens.append(True)
        )
    )
    assert result.response_text == "The deadline is Friday."
    assert attempts == [False, True]
    assert tokens == [True]


def test_repeated_echo_never_returned_to_tts(monkeypatch):
    attempts = []

    async def generate(context, callback, *, repair_echo=False):
        attempts.append(repair_echo)
        return reply(QUESTION)

    monkeypatch.setattr(reasoning, "_reason_once", generate)
    with pytest.raises(HTTPException) as error:
        asyncio.run(reasoning.reason({"question": QUESTION}))
    assert error.value.status_code == 502
    assert attempts == [False, True]


def test_good_answer_does_not_retry(monkeypatch):
    async def generate(context, callback, *, repair_echo=False):
        assert not repair_echo
        return reply("The deadline is Friday.")

    monkeypatch.setattr(reasoning, "_reason_once", generate)
    assert (
        asyncio.run(
            reasoning.reason({"question": "What is the deadline?"})
        ).response_text
        == "The deadline is Friday."
    )
