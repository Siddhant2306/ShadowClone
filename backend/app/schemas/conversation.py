from typing import Literal
from pydantic import BaseModel, Field


class TurnInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class ChannelInput(BaseModel):
    channel: Literal["simulated_call", "simulated_meeting"]


class Resolution(BaseModel):
    approve: bool
    text: str = Field(max_length=3000)
