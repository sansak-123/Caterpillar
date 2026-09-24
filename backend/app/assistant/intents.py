"""Intent routing for the assistant — CLAUDE.md section 6: "Intents: log incident,
explain estimate, safety question, 'why was I flagged', book instructor." This keyword
matcher is intentionally simple and dependency-free so it can run identically as (a) the
server's first-pass router before deciding whether an LLM call is even needed, and (b)
the model the mobile app's on-device offline fallback mirrors in lib/assistant/offline.ts
when there's no network to reach this backend at all.
"""

from __future__ import annotations

from enum import Enum


class Intent(str, Enum):  # noqa: UP042 — StrEnum needs Python 3.11; this venv runs 3.10
    LOG_INCIDENT = "log_incident"
    EXPLAIN_ESTIMATE = "explain_estimate"
    WHY_FLAGGED = "why_flagged"
    BOOK_INSTRUCTOR = "book_instructor"
    SAFETY_QUESTION = "safety_question"
    GENERAL = "general"


# Order matters: checked top to bottom, first match wins. LOG_INCIDENT and
# WHY_FLAGGED are checked before the broader SAFETY_QUESTION bucket so e.g.
# "why was I flagged for idling" routes to WHY_FLAGGED, not SAFETY_QUESTION.
_KEYWORDS: dict[Intent, tuple[str, ...]] = {
    Intent.LOG_INCIDENT: (
        "log incident",
        "report incident",
        "log a near",
        "report a near",
        "near miss",
        "near-miss",
        "something happened",
        "i crashed",
        "i hit",
        "i ran over",
        "i ran into",
        "i struck",
        "i collided",
        "i almost hit",
        "collision",
        "collided",
        "rolled over",
        "rollover happened",
        "pinned",
        "someone was hurt",
        "worker was hurt",
        "person was hurt",
    ),
    Intent.WHY_FLAGGED: (
        "why was i flagged",
        "why am i flagged",
        "why flagged",
        "my flags",
        "my anomaly",
        "why did i get",
    ),
    Intent.EXPLAIN_ESTIMATE: (
        "explain my estimate",
        "explain estimate",
        "why is my estimate",
        "why is this task",
        "task time",
        "how long will",
        "estimate",
    ),
    Intent.BOOK_INSTRUCTOR: (
        "book instructor",
        "book an instructor",
        "book a trainer",
        "schedule training",
        "instructor",
    ),
    Intent.SAFETY_QUESTION: (
        "seatbelt",
        "proximity",
        "idle",
        "fatigue",
        "slope",
        "rollover",
        "hazard",
        "safety",
    ),
}


def match_intent(text: str) -> Intent:
    lowered = text.lower()
    for intent, keywords in _KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return intent
    return Intent.GENERAL


LANGUAGE_NAMES: dict[str, str] = {"en": "English", "hi": "Hindi", "ta": "Tamil"}


def language_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, "English")
