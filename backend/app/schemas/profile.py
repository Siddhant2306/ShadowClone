from typing import Literal
from pydantic import BaseModel, Field


class ProfileInput(BaseModel):
    display_name: str = Field(max_length=100)
    communication_style: str = Field(max_length=2000)
    preferred_languages: str = Field(max_length=200)
    knowledge: str = Field(max_length=4000)
    restricted_topics: str = Field(max_length=2000)
