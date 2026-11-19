"""Conservative checks for copied questions, not a general answer-quality score."""

import unicodedata
from difflib import SequenceMatcher


def normalized_words(text: str) -> list[str]:
    # Keep combining marks: deleting them damages Hindi words.
    text = unicodedata.normalize("NFKC", text).casefold()
    return "".join(
        char if unicodedata.category(char)[0] in {"L", "M", "N"} else " "
        for char in text
    ).split()


def echoes_question(question: str, response: str) -> bool:
    question_words = normalized_words(question)
    response_words = normalized_words(response)
    if not question_words or not response_words:
        return False
    # Allow ordinary matching greetings/acknowledgements such as "hello".
    if question_words == response_words:
        return len(question_words) >= 4 or "?" in question or "？" in question
    # Catch cosmetic edits to a long copied question, not shared topical vocabulary.
    if min(len(question_words), len(response_words)) < 6:
        return False
    return SequenceMatcher(None, question_words, response_words).ratio() >= 0.92
