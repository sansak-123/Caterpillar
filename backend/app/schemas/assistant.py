from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel


class AssistantChatRequest(BaseModel):
    message: str
    language: str | None = None  # falls back to the operator's profile language
    task_id: str | None = None  # which task the operator was looking at, if any


class AssistantAction(BaseModel):
    """Tells the mobile UI to do something beyond showing text — e.g. open the
    dedicated incident-report or booking flow for a quick-action tile."""

    type: str
    payload: dict = {}


class AssistantChatResponse(BaseModel):
    reply: str
    intent: str
    language: str
    # "llm": phrased/translated by the OpenRouter model. "grounded": a real, data-backed
    # template sentence with no model call needed. "degraded_no_key": no OPENROUTER_API_KEY
    # configured, so free-form questions fall back to a canned pointer to what still works.
    source: Literal["llm", "grounded", "degraded_no_key"]
    actions: list[AssistantAction] = []


class IncidentReportRequest(BaseModel):
    transcript: str
    language: str | None = None
    machine_id: str


class IncidentReportResponse(BaseModel):
    incident_id: str
    type: str
    severity: str
    is_near_miss: bool
    trigger: str
    summary: str
    confidence: float
    # "llm": structured by the OpenRouter model. "heuristic": a low-confidence keyword
    # fallback used when no key is configured or the model call fails — always drafted,
    # never auto-filed, per USP-2's confirm-before-it-counts design.
    source: Literal["llm", "heuristic"]


class BookingRequest(BaseModel):
    message: str
    language: str | None = None


class BookingResponse(BaseModel):
    booking_id: int
    slot_start: dt.datetime
    slot_end: dt.datetime
    status: str
    reply: str
    source: Literal["llm", "grounded", "degraded_no_key"]
