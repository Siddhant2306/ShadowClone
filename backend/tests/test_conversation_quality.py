from app.reasoning import participant_prompt
from app.services.speech import spoken_text


def test_current_question_separate_from_old_context():
    prompt = participant_prompt(
        {
            "history": [{"role": "user", "content": "Old topic"}],
            "question": "What is the deadline?",
        }
    )
    assert prompt.endswith('"What is the deadline?"')
    assert prompt.index("Old topic") < prompt.index("CURRENT participant question")


def test_speech_cleanup_preserves_numbers():
    assert spoken_text("**Friday**, at 3:30 PM") == "Friday, at 3:30 PM."
    assert spoken_text("See [details](https://example.com)") == "See details."
