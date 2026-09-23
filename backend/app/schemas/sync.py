from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field


class OutboxEvent(BaseModel):
    event_id: str
    type: str
    payload: dict
    created_at: dt.datetime
    device_id: str
    attempt: int = 1


class SyncPushRequest(BaseModel):
    events: list[OutboxEvent] = Field(default_factory=list, max_length=500)


class SyncPushResponse(BaseModel):
    acked: list[str]


class SyncPullResponse(BaseModel):
    cursor: str
    tasks: list[dict]
    bookings: list[dict]
    training_assignments: list[dict]
    model_bundle: dict | None
