"""Remove display-only markup without changing approved spoken meaning."""

import re
import unicodedata


def spoken_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\[([^\]]+)\]\(https?://[^)]+\)", r"\1", text)
    text = re.sub(r"(?m)^\s*(?:#{1,6}\s+|[-*]\s+)", "", text)
    text = text.replace("**", "").replace("__", "").replace("`", "")
    text = re.sub(r"\s+", " ", text).strip()
    if text and text[-1] not in ".!?।":
        text += "."
    return text
