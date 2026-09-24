"""Assistant orchestration — CLAUDE.md section 6 ("Assistant") and section 3.1
("Online: an OpenRouter-hosted model... Offline: intent matcher + MiniSearch").

Design principle: every intent that *can* be answered from real data (explain_estimate,
why_flagged) is answered from real data first — a grounded template sentence built from
an actual Task/Alert/Incident row, never invented. The OpenRouter model (config value
`assistant_fast_model` / `assistant_strong_model`, currently a free Gemini slug — see
app/core/config.py) is layered on top only to phrase that sentence naturally and
translate it into the operator's language, and is the sole source of an answer for
genuinely open-ended questions. Any OpenRouter failure (no key configured, network
error, malformed response) falls back to the grounded/canned text instead of a 500 —
this endpoint is a cloud convenience, not a safety path, but it should still never break
the app it's answering for.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import uuid
from typing import Awaitable, Callable, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.assistant.gemini_client import generate_gemini_text
from app.assistant.intents import Intent, language_name, match_intent
from app.assistant.openrouter_client import get_openrouter_client
from app.core.config import get_settings
from app.models import Alert, Booking, Incident, Machine, Operator, Site, Task, TelemetryMinute
from app.schemas.assistant import (
    AssistantAction,
    AssistantChatRequest,
    AssistantChatResponse,
    BookingRequest,
    BookingResponse,
    IncidentReportRequest,
    IncidentReportResponse,
)
from app.services.ml_service import get_task_time_model

logger = logging.getLogger(__name__)

_T = TypeVar("_T")


async def _with_retry(call: Callable[[], Awaitable[_T]], *, label: str, attempts: int = 2) -> _T:
    """Free-tier OpenRouter models intermittently rate-limit or cold-start (a 429 or a
    brief timeout, not a real outage) — see calibration.md-style note: this was caught
    live, a real user message got the generic degraded fallback even though the key and
    model were both genuinely working seconds before and after. One quick retry absorbs
    that without masking an actually-broken key (every attempt's failure is logged)."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await call()
        except Exception as exc:  # noqa: BLE001 — logged below, re-raised to the caller's own fallback
            last_exc = exc
            logger.warning("[assistant] %s failed (attempt %d/%d): %r", label, attempt, attempts, exc)
            if attempt < attempts:
                await asyncio.sleep(0.5)
    assert last_exc is not None
    raise last_exc


def _has_llm_key() -> bool:
    settings = get_settings()
    return bool(settings.gemini_api_key or settings.openrouter_api_key)


async def _generate_llm(
    *, system: str, prompt: str, max_tokens: int, temperature: float, json_output: bool = False
) -> str:
    """Use direct Gemini when configured, otherwise preserve the OpenRouter fallback."""
    settings = get_settings()
    if settings.gemini_api_key:
        return await _with_retry(
            lambda: generate_gemini_text(
                system=system,
                prompt=prompt,
                max_output_tokens=max_tokens,
                temperature=temperature,
                json_output=json_output,
            ),
            label="Gemini",
        )
    if not _has_llm_key():
        raise RuntimeError("No LLM API key configured")

    client = get_openrouter_client()
    response = await _with_retry(
        lambda: client.chat.completions.create(
            model=settings.assistant_strong_model if json_output else settings.assistant_fast_model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
            response_format={"type": "json_object"} if json_output else None,
        ),
        label="OpenRouter",
    )
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise ValueError("OpenRouter returned an empty completion")
    return text

_SAFETY_KB: tuple[tuple[str, str], ...] = (
    (
        "seatbelt",
        "Seatbelt alerts only fire once the machine is moving or swinging and the belt "
        "has been off for more than 5 seconds — idle-with-belt-off just gets a quiet "
        "reminder. It exists to survive a rollover, nothing else.",
    ),
    (
        "proximity",
        "Proximity zones aren't fixed rings — they widen automatically in rain, wind, or "
        "low visibility, and the rear sector counts more because it's your blind spot.",
    ),
    (
        "idle",
        "Tapping a reason after idling 3+ minutes isn't about watching you — it's proof "
        "on record that a delay like a truck wait or warm-up wasn't your fault.",
    ),
    (
        "fatigue",
        "The fatigue check looks at hours awake and consecutive night shifts. It's "
        "private coaching for you, not a number your supervisor sees.",
    ),
    (
        "slope",
        "Slope alerts are based on your machine class's tested rollover stability angle, "
        "and tighten further on wet or soft ground.",
    ),
    (
        "rollover",
        "Rollover risk is flagged from real-time slope against your machine class's "
        "tested stability angle (ISO 3471 ROPS methodology), tightened on wet ground.",
    ),
    (
        "near miss",
        "A near-miss gets drafted automatically the moment it's detected, but nothing is "
        "filed until you confirm it — a tap once stopped, or a spoken word any time.",
    ),
    (
        "hazard",
        "Task cards list known hazards — buried utilities, slopes, nearby workers — so "
        "you're not finding them for the first time on the ground.",
    ),
)


def _kb_lookup(text: str) -> str | None:
    lowered = text.lower()
    for keyword, answer in _SAFETY_KB:
        if keyword in lowered:
            return answer
    return None


async def _operator_language(session: AsyncSession, user: CurrentUser) -> str:
    if user.operator_id:
        operator = await session.get(Operator, user.operator_id)
        if operator is not None:
            return operator.language
    return "en"


async def _maybe_llm_phrase(language: str, grounded_text: str) -> tuple[str, str]:
    """Rephrase/translate a grounded sentence via the fast model. Returns the original
    text unchanged (source="grounded") the moment anything about the call isn't clean —
    missing key, network error, empty completion — rather than ever raising."""
    settings = get_settings()
    if not _has_llm_key():
        return grounded_text, "grounded"
    if settings.gemini_api_key:
        try:
            text = await _generate_llm(
                system=(
                    "Rephrase the following operator-facing message in "
                    f"{language_name(language)}, keeping it to 1-2 short sentences a driver can "
                    "glance at or hear read aloud. Keep every number and fact exactly as given."
                ),
                prompt=grounded_text,
                max_tokens=200,
                temperature=0.3,
            )
            return text, "llm"
        except Exception:
            return grounded_text, "grounded"
    try:
        if settings.gemini_api_key:
            text = await _generate_llm(
                system=_chat_system_prompt(language, kb_hit),
                prompt=body.message,
                max_tokens=220,
                temperature=0.4,
            )
            return AssistantChatResponse(reply=text, intent=intent, language=language, source="llm")
        client = get_openrouter_client()
        response = await _with_retry(
            lambda: client.chat.completions.create(
                model=settings.assistant_fast_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Rephrase the following operator-facing message in "
                            f"{language_name(language)}, keeping it to 1-2 short sentences a "
                            "driver can glance at or hear read aloud. Keep every number and "
                            "fact exactly as given — do not invent or drop any."
                        ),
                    },
                    {"role": "user", "content": grounded_text},
                ],
                max_tokens=200,
                temperature=0.3,
            ),
            label="_maybe_llm_phrase",
        )
        text = (response.choices[0].message.content or "").strip()
        return (text, "llm") if text else (grounded_text, "grounded")
    except Exception:
        return grounded_text, "grounded"


def _chat_system_prompt(language: str, kb_hit: str | None, operator_context: str | None = None) -> str:
    grounding = f" Relevant fact you must stay consistent with: {kb_hit}" if kb_hit else ""
    context = (
        f" Operator context for this signed-in user: {operator_context}"
        if operator_context
        else " No operator context is currently available. Do not invent it."
    )
    return (
        "You are the OperatorOS in-cab voice/text assistant for a CAT excavator or "
        f"loader operator. Reply in {language_name(language)}, in at most 2 short "
        "sentences suitable for glancing at a screen or hearing read aloud. Never invent "
        "specific numbers, thresholds, or machine data you weren't given. This product's "
        "safety and idle features are designed to protect and never police the "
        "operator — answer in that spirit. If asked for exact GPS and it is not present, "
        "say that only the assigned site location is available." + grounding + context
    )


async def _operator_context(session: AsyncSession, user: CurrentUser) -> str | None:
    """Build a small, private context snapshot for the signed-in operator."""
    if not user.operator_id:
        return None

    operator = await session.get(Operator, user.operator_id)
    if operator is None:
        return None

    tasks = list(
        await session.scalars(
            select(Task)
            .where(Task.operator_id == user.operator_id, Task.scheduled_date == dt.date.today())
            .order_by(Task.status, Task.created_at)
        )
    )
    task_lines: list[str] = []
    site_ids = {task.site_id for task in tasks}
    sites = {
        site.site_id: site
        for site in await session.scalars(select(Site).where(Site.site_id.in_(site_ids)))
    }
    for task in tasks[:5]:
        site = sites.get(task.site_id)
        site_text = f"site {site.name} ({site.lat}, {site.lon})" if site else f"site {task.site_id}"
        task_lines.append(
            f"{task.task_id} {task.task_type}, {task.status}, estimate {task.est_min:g} min, {site_text}"
        )

    latest = await session.scalar(
        select(TelemetryMinute)
        .where(TelemetryMinute.operator_id == user.operator_id)
        .order_by(TelemetryMinute.ts.desc())
        .limit(1)
    )
    telemetry_text = "no recent telemetry"
    if latest is not None:
        telemetry_text = (
            f"machine {latest.machine_id}, state {latest.state}, seatbelt {latest.seatbelt}, "
            f"travel {latest.travel_kmh:g} km/h, swing {latest.swing_rate_dps:g} dps, "
            f"zone {latest.zone or 'unknown'}, nearest person "
            f"{latest.nearest_person_m if latest.nearest_person_m is not None else 'unknown'} m"
        )

    alerts = list(
        await session.scalars(
            select(Alert)
            .where(Alert.operator_id == user.operator_id)
            .order_by(Alert.ts.desc())
            .limit(3)
        )
    )
    incidents = list(
        await session.scalars(
            select(Incident)
            .where(Incident.operator_id == user.operator_id)
            .order_by(Incident.ts.desc())
            .limit(3)
        )
    )
    alert_text = ", ".join(f"{item.type}/{item.severity}" for item in alerts) or "none"
    incident_text = ", ".join(f"{item.type}/{item.severity}" for item in incidents) or "none"
    tasks_text = "; ".join(task_lines) or "none scheduled today"
    return (
        f"operator {operator.operator_id}, skill {operator.skill}, shift {operator.shift}; "
        f"today's tasks: {tasks_text}; latest telemetry: {telemetry_text}; "
        f"recent alerts: {alert_text}; recent incidents: {incident_text}"
    )


async def _resolve_task(
    session: AsyncSession, operator_id: str, task_id: str | None
) -> Task | None:
    if task_id:
        return await session.scalar(
            select(Task).where(Task.task_id == task_id, Task.operator_id == operator_id)
        )
    today = dt.date.today()
    in_progress = await session.scalar(
        select(Task)
        .where(
            Task.operator_id == operator_id,
            Task.scheduled_date == today,
            Task.status == "in_progress",
        )
        .order_by(Task.created_at)
    )
    if in_progress is not None:
        return in_progress
    return await session.scalar(
        select(Task)
        .where(
            Task.operator_id == operator_id,
            Task.scheduled_date == today,
            Task.status == "pending",
        )
        .order_by(Task.created_at)
    )


async def _explain_estimate(
    session: AsyncSession, user: CurrentUser, language: str, body: AssistantChatRequest
) -> AssistantChatResponse:
    if not user.operator_id:
        reply, source = await _maybe_llm_phrase(
            language,
            "You're not signed in as an operator, so there's no task estimate to explain.",
        )
        return AssistantChatResponse(
            reply=reply, intent=Intent.EXPLAIN_ESTIMATE, language=language, source=source
        )

    task = await _resolve_task(session, user.operator_id, body.task_id)
    if task is None:
        reply, source = await _maybe_llm_phrase(
            language, "You don't have a task scheduled right now."
        )
        return AssistantChatResponse(
            reply=reply, intent=Intent.EXPLAIN_ESTIMATE, language=language, source=source
        )

    machine = await session.get(Machine, task.machine_id)
    model = get_task_time_model()
    features = {
        "task_type": task.task_type,
        "weather": task.weather_condition,
        "machine_age_yrs": machine.age_yrs if machine else None,
        "hours_since_last_service": machine.hours_since_last_service if machine else None,
        "hour_of_day": dt.datetime.utcnow().hour,
        "day_of_week": dt.date.today().weekday(),
    }
    prediction = model.predict(features, task.est_min)
    reasons = prediction["reasons"]
    reasons_text = f" Why: {'; '.join(reasons)}." if reasons else ""
    grounded = (
        f"Your {task.task_type} task is estimated at {round(prediction['value'])} min, "
        f"up to {round(prediction['range'][1])} min in a tougher case.{reasons_text}"
    )
    reply, source = await _maybe_llm_phrase(language, grounded)
    return AssistantChatResponse(
        reply=reply,
        intent=Intent.EXPLAIN_ESTIMATE,
        language=language,
        source=source,
        actions=[
            AssistantAction(
                type="show_breakdown", payload={"task_id": task.task_id, "reasons": reasons}
            )
        ],
    )


async def _why_flagged(
    session: AsyncSession, user: CurrentUser, language: str
) -> AssistantChatResponse:
    if not user.operator_id:
        reply, source = await _maybe_llm_phrase(language, "You're not signed in as an operator.")
        return AssistantChatResponse(
            reply=reply, intent=Intent.WHY_FLAGGED, language=language, source=source
        )

    alerts = (
        await session.scalars(
            select(Alert)
            .where(Alert.operator_id == user.operator_id)
            .order_by(Alert.ts.desc())
            .limit(5)
        )
    ).all()
    incidents = (
        await session.scalars(
            select(Incident)
            .where(Incident.operator_id == user.operator_id)
            .order_by(Incident.ts.desc())
            .limit(5)
        )
    ).all()

    if not alerts and not incidents:
        grounded = (
            "No recent safety flags on your record — clean sheet. This is your private "
            "view; supervisors only see site-level patterns, not a personal scoreboard."
        )
    else:
        bits = [f"{a.type} ({a.severity}) at {a.ts:%d %b %H:%M}" for a in list(alerts)[:3]]
        bits += [f"{i.type} incident at {i.ts:%d %b %H:%M}" for i in list(incidents)[:2]]
        grounded = (
            "Recent flags on your record: "
            + "; ".join(bits)
            + ". This is your private view — supervisors see site-level patterns, not "
            "your personal history, unless you confirm one yourself."
        )
    reply, source = await _maybe_llm_phrase(language, grounded)
    return AssistantChatResponse(
        reply=reply, intent=Intent.WHY_FLAGGED, language=language, source=source
    )


async def _safety_or_general(
    session: AsyncSession,
    user: CurrentUser,
    language: str,
    body: AssistantChatRequest,
    intent: Intent,
) -> AssistantChatResponse:
    settings = get_settings()
    kb_hit = _kb_lookup(body.message)
    operator_context = await _operator_context(session, user)

    if not _has_llm_key():
        if kb_hit:
            reply, source = kb_hit, "grounded"
        else:
            reply = (
                "I can answer from the built-in safety notes, or try 'explain my "
                "estimate', 'why was I flagged', or 'book instructor'."
            )
            source = "degraded_no_key"
        return AssistantChatResponse(reply=reply, intent=intent, language=language, source=source)

    if settings.gemini_api_key:
        try:
            text = await _generate_llm(
                system=_chat_system_prompt(language, kb_hit, operator_context),
                prompt=body.message,
                max_tokens=220,
                temperature=0.4,
            )
            return AssistantChatResponse(reply=text, intent=intent, language=language, source="llm")
        except Exception as exc:
            logger.warning("[assistant] Gemini gave up after retries: %r", exc)
            if kb_hit:
                return AssistantChatResponse(
                    reply=kb_hit, intent=intent, language=language, source="grounded"
                )

    try:
        client = get_openrouter_client()
        response = await _with_retry(
            lambda: client.chat.completions.create(
                model=settings.assistant_fast_model,
                messages=[
                    {"role": "system", "content": _chat_system_prompt(language, kb_hit, operator_context)},
                    {"role": "user", "content": body.message},
                ],
                max_tokens=220,
                temperature=0.4,
            ),
            label="_safety_or_general",
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            raise ValueError("empty completion")
        return AssistantChatResponse(reply=text, intent=intent, language=language, source="llm")
    except Exception as exc:
        logger.warning("[assistant] _safety_or_general gave up after retries: %r", exc)
        if kb_hit:
            return AssistantChatResponse(
                reply=kb_hit, intent=intent, language=language, source="grounded"
            )
        reply = (
            "I couldn't reach the assistant model right now. Try again once you're back "
            "online, or ask about seatbelt, proximity, idle, fatigue, slope, or near-miss rules."
        )
        return AssistantChatResponse(
            reply=reply, intent=intent, language=language, source="degraded_no_key"
        )


async def handle_chat(
    session: AsyncSession, user: CurrentUser, body: AssistantChatRequest
) -> AssistantChatResponse:
    language = body.language or await _operator_language(session, user)
    intent = match_intent(body.message)

    if intent == Intent.EXPLAIN_ESTIMATE:
        return await _explain_estimate(session, user, language, body)
    if intent == Intent.WHY_FLAGGED:
        return await _why_flagged(session, user, language)
    if intent == Intent.LOG_INCIDENT:
        grounded = (
            "Tell me what happened and I'll draft it, or use the Log Incident action so "
            "I can attach your machine automatically."
        )
        reply, source = await _maybe_llm_phrase(language, grounded)
        return AssistantChatResponse(
            reply=reply,
            intent=intent,
            language=language,
            source=source,
            actions=[AssistantAction(type="open_incident_report")],
        )
    if intent == Intent.BOOK_INSTRUCTOR:
        grounded = (
            "I can request the next available instructor slot for you — tap Book "
            "instructor to confirm."
        )
        reply, source = await _maybe_llm_phrase(language, grounded)
        return AssistantChatResponse(
            reply=reply,
            intent=intent,
            language=language,
            source=source,
            actions=[AssistantAction(type="open_booking")],
        )

    return await _safety_or_general(session, user, language, body, intent)


def _heuristic_structure_incident(transcript: str) -> dict:
    """Low-confidence keyword fallback used with no OpenRouter key, or if the model call
    fails/returns something unparseable. Always marked low-confidence and always saved
    as an unconfirmed draft — CLAUDE.md USP-2: nothing is filed until a human confirms
    it, so a rough-but-safe draft here is fine."""
    lowered = transcript.lower()
    if any(w in lowered for w in ("rollover", "tipped", "tipping")):
        incident_type = "rollover"
    elif any(w in lowered for w in ("caught", "pinned", "trapped")) or "between" in lowered:
        incident_type = "caught_between"
    elif any(w in lowered for w in ("worker", "person", "someone", "colleague")) and any(
        w in lowered for w in ("close", "near", "almost", "swing", "behind")
    ):
        incident_type = "struck_by"
    else:
        incident_type = "other"

    injury_markers = ("injured", "injury", "hurt", "broken", "bleeding")
    near_miss_markers = (
        "almost",
        "close call",
        "near miss",
        "near-miss",
        "didn't hit",
        "no contact",
    )
    has_injury = any(w in lowered for w in injury_markers)
    has_near_miss_marker = any(w in lowered for w in near_miss_markers)
    if has_injury and not has_near_miss_marker:
        severity, is_near_miss = "Moderate", False
    else:
        severity, is_near_miss = "Near-miss", True

    return {
        "type": incident_type,
        "severity": severity,
        "is_near_miss": is_near_miss,
        "root_cause_category": None,
        "corrective_action": None,
        "summary": transcript.strip()[:140],
        "confidence": 0.35,
    }


_INCIDENT_JSON_KEYS = (
    "type",
    "severity",
    "is_near_miss",
    "root_cause_category",
    "corrective_action",
    "summary",
    "confidence",
)


async def _llm_structure_incident(transcript: str, language: str) -> dict:
    settings = get_settings()
    client = get_openrouter_client()
    system = (
        "You structure a CAT machine operator's spoken incident report into strict JSON. "
        f'The operator spoke in {language_name(language)}. Return ONLY a JSON object with '
        'exactly these keys: "type" (one of struck_by, caught_between, rollover, '
        'equipment_damage, other), "severity" (one of Near-miss, Minor, Moderate, Severe), '
        '"is_near_miss" (boolean), "root_cause_category" (short string or null), '
        '"corrective_action" (short string or null), "summary" (one plain English '
        "sentence, regardless of the spoken language, so supervisors reading many "
        'reports see a consistent language), "confidence" (0 to 1 float, your honest '
        "confidence given how much detail was actually said)."
    )
    response = await _with_retry(
        lambda: client.chat.completions.create(
            model=settings.assistant_strong_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": transcript},
            ],
            max_tokens=300,
            temperature=0.1,
            response_format={"type": "json_object"},
        ),
        label="_llm_structure_incident",
    )
    text = response.choices[0].message.content or ""
    parsed = json.loads(text)
    if not all(key in parsed for key in _INCIDENT_JSON_KEYS):
        raise ValueError("incomplete incident JSON from model")
    return parsed


async def handle_incident_report(
    session: AsyncSession, user: CurrentUser, body: IncidentReportRequest
) -> IncidentReportResponse:
    if user.role != "operator" or not user.operator_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "voice incident reporting requires an operator account"
        )

    language = body.language or await _operator_language(session, user)
    settings = get_settings()
    parsed: dict | None = None
    source = "heuristic"
    if settings.openrouter_api_key:
        try:
            parsed = await _llm_structure_incident(body.transcript, language)
            source = "llm"
        except Exception as exc:
            logger.warning("[assistant] _llm_structure_incident gave up after retries: %r", exc)
            parsed = None
    if parsed is None:
        parsed = _heuristic_structure_incident(body.transcript)
        source = "heuristic"

    incident_id = f"INC{uuid.uuid4().hex[:13]}"
    incident = Incident(
        id=incident_id,
        ts=dt.datetime.utcnow(),
        machine_id=body.machine_id,
        operator_id=user.operator_id,
        type=parsed["type"],
        severity=parsed["severity"],
        is_near_miss=bool(parsed["is_near_miss"]),
        trigger="voice_report",
        root_cause_category=parsed.get("root_cause_category"),
        corrective_action=parsed.get("corrective_action"),
        context_json=json.dumps({"transcript": body.transcript, "summary": parsed["summary"]}),
        confirmed=False,
    )
    session.add(incident)
    await session.commit()

    return IncidentReportResponse(
        incident_id=incident_id,
        type=parsed["type"],
        severity=parsed["severity"],
        is_near_miss=bool(parsed["is_near_miss"]),
        trigger="voice_report",
        summary=parsed["summary"],
        confidence=float(parsed.get("confidence", 0.5)),
        source=source,  # type: ignore[arg-type]
    )


def _next_available_slot() -> tuple[dt.datetime, dt.datetime]:
    """No real instructor-availability table exists yet — this is a deliberately simple
    stand-in (next day, 09:00) rather than a fake scheduling engine; a supervisor still
    confirms the request (Booking.status starts 'requested')."""
    tomorrow = dt.datetime.utcnow().replace(
        hour=9, minute=0, second=0, microsecond=0
    ) + dt.timedelta(days=1)
    return tomorrow, tomorrow + dt.timedelta(minutes=45)


async def handle_booking_request(
    session: AsyncSession, user: CurrentUser, body: BookingRequest
) -> BookingResponse:
    if user.role != "operator" or not user.operator_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "instructor booking requires an operator account"
        )

    language = body.language or await _operator_language(session, user)
    slot_start, slot_end = _next_available_slot()
    booking = Booking(
        operator_id=user.operator_id,
        instructor_name="Site instructor (auto-assigned)",
        slot_start=slot_start,
        slot_end=slot_end,
        status="requested",
        created_offline=False,
    )
    session.add(booking)
    await session.commit()
    await session.refresh(booking)

    grounded = (
        f"Booked a training slot for {slot_start:%a %d %b, %H:%M}. "
        "Your supervisor will confirm it."
    )
    reply, source = await _maybe_llm_phrase(language, grounded)
    return BookingResponse(
        booking_id=booking.id,
        slot_start=slot_start,
        slot_end=slot_end,
        status=booking.status,
        reply=reply,
        source=source,  # type: ignore[arg-type]
    )
