from typing import Literal
from pydantic import BaseModel, Field


class TurnInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class ChannelInput(BaseModel):
    channel: Literal["simulated_call", "simulated_meeting", "google_meet_live"]
    participants_consented: bool = False
    meeting_context: str = Field(default="", max_length=8000)


class MeetingContextInput(BaseModel):
    content: str = Field(max_length=8000)


class Resolution(BaseModel):
    approve: bool
    text: str = Field(max_length=3000)
