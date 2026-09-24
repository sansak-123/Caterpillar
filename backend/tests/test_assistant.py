from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assistant.intents import Intent, match_intent
from app.models import Booking, Incident


def test_match_intent_explain_estimate() -> None:
    assert match_intent("why is my estimate for today so long") == Intent.EXPLAIN_ESTIMATE


def test_match_intent_why_flagged_before_safety() -> None:
    # "idle" alone would match SAFETY_QUESTION, but the more specific "why flagged"
    # phrase must win when both are present.
    assert match_intent("why was i flagged for idling") == Intent.WHY_FLAGGED


def test_match_intent_log_incident() -> None:
    assert match_intent("I need to log a near miss from this morning") == Intent.LOG_INCIDENT


def test_match_intent_book_instructor() -> None:
    assert match_intent("can I book an instructor for tomorrow") == Intent.BOOK_INSTRUCTOR


def test_match_intent_safety_question() -> None:
    assert match_intent("what does the seatbelt alert actually do") == Intent.SAFETY_QUESTION


def test_match_intent_general_fallback() -> None:
    assert match_intent("good morning") == Intent.GENERAL


async def _login_operator(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "username": "op1001_assistant",
            "password": "pw12345",
            "role": "operator",
            "operator_id": "OP1001",
        },
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


async def _login_supervisor(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/register",
        json={"username": "sup1_assistant", "password": "pw12345", "role": "supervisor"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


async def test_explain_estimate_uses_real_seeded_task(
    client: AsyncClient, seeded: dict, no_openrouter_key: None
) -> None:
    token = await _login_operator(client)
    resp = await client.post(
        "/assistant/chat",
        json={"message": "why is my estimate today so long"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "explain_estimate"
    # Forced no-key (see no_openrouter_key), so this must be the grounded template, not
    # an LLM call — and it must be built from the seeded task, not invented.
    assert data["source"] == "grounded"
    assert "Earth Excavation" in data["reply"]


async def test_why_flagged_with_no_alerts_reads_as_clean(client: AsyncClient, seeded: dict) -> None:
    token = await _login_operator(client)
    resp = await client.post(
        "/assistant/chat",
        json={"message": "why was i flagged this week"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "why_flagged"
    assert "clean" in data["reply"].lower() or "no recent" in data["reply"].lower()


async def test_safety_question_answers_from_kb_without_key(
    client: AsyncClient, seeded: dict, no_openrouter_key: None
) -> None:
    token = await _login_operator(client)
    resp = await client.post(
        "/assistant/chat",
        json={"message": "why does the seatbelt alert even matter"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "safety_question"
    assert data["source"] == "grounded"
    assert "rollover" in data["reply"].lower()


async def test_log_incident_creates_unconfirmed_draft(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    token = await _login_operator(client)
    transcript = "A worker walked in close behind me while I was swinging, almost got hit"
    resp = await client.post(
        "/assistant/incident",
        json={"transcript": transcript, "machine_id": "EXC001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["source"] == "heuristic"  # no OPENROUTER_API_KEY in the test env
    assert data["type"] == "struck_by"
    assert data["is_near_miss"] is True

    incident = await db_session.get(Incident, data["incident_id"])
    assert incident is not None
    assert incident.confirmed is False  # drafted, never auto-filed (USP-2)
    assert incident.trigger == "voice_report"


async def test_log_incident_requires_operator_role(client: AsyncClient, seeded: dict) -> None:
    token = await _login_supervisor(client)
    resp = await client.post(
        "/assistant/incident",
        json={"transcript": "test", "machine_id": "EXC001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


async def test_book_instructor_creates_requested_booking(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    token = await _login_operator(client)
    resp = await client.post(
        "/assistant/booking",
        json={"message": "book me the next available instructor slot"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "requested"

    booking = await db_session.scalar(select(Booking).where(Booking.id == data["booking_id"]))
    assert booking is not None
    assert booking.operator_id == "OP1001"
