from typing import Literal
from pydantic import BaseModel, Field


class MemoryInput(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    category: Literal["personal_fact", "preference", "knowledge", "decision"]
