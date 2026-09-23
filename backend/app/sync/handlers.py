"""Applies the business-logic side effect of one outbox event — called exactly once
per event_id (the caller in app/api/sync.py checks sync_events for that guarantee), so
handlers don't need to be idempotent themselves.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import engine
from app.models import Alert, IdleTag, Incident, Task, TelemetryMinute


def _parse_iso(ts: str) -> dt.datetime:
    """`datetime.fromisoformat` only accepts a trailing 'Z' from Python 3.11 — this venv
    runs 3.10, and every real device client (JS `Date.toISOString()`) always emits one,
    so this normalizes it rather than 500ing on every real sync payload."""
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))


async def apply_task_status_update(session: AsyncSession, payload: dict) -> None:
    """CLAUDE.md section 3.1 conflict rule: tasks are server-authoritative with
    `version`. If the operator changed status offline and the server's version has
    since moved past what the device last saw (`base_version`), we still keep the
    operator's status (never silently discard it) but flag `conflict=True` for
    supervisor review instead of quietly resolving it."""
    task = await session.scalar(select(Task).where(Task.task_id == payload["task_id"]))
    if task is None:
        return

    base_version = payload.get("base_version", task.version)
    task.status = payload["status"]
    if payload["status"] == "done" and "actual_min" in payload:
        task.actual_min = payload["actual_min"]

    if base_version != task.version:
        task.conflict = True
    task.version += 1


async def apply_idle_tag(session: AsyncSession, payload: dict) -> None:
    exists = await session.scalar(select(IdleTag).where(IdleTag.window_id == payload["window_id"]))
    if exists is not None:
        return
    session.add(
        IdleTag(
            window_id=payload["window_id"],
            machine_id=payload["machine_id"],
            operator_id=payload["operator_id"],
            ts_start=_parse_iso(payload["ts_start"]),
            ts_end=_parse_iso(payload["ts_end"]),
            duration_min=payload["duration_min"],
            reason=payload["reason"],
        )
    )


async def apply_incident_confirm(session: AsyncSession, payload: dict) -> None:
    """A Near-Miss Autopilot draft (CLAUDE.md USP-2) being confirmed or dismissed by
    the operator. If the incident doesn't exist yet (drafted and confirmed entirely
    offline), create it from the payload."""
    incident = await session.scalar(select(Incident).where(Incident.id == payload["incident_id"]))
    if incident is None:
        incident = Incident(
            id=payload["incident_id"],
            ts=_parse_iso(payload["ts"]),
            machine_id=payload["machine_id"],
            operator_id=payload["operator_id"],
            type=payload.get("type", "unknown"),
            severity=payload.get("severity", "Near-miss"),
            is_near_miss=payload.get("is_near_miss", True),
            trigger=payload.get("trigger", "unknown"),
            context_json=payload.get("context_json"),
        )
        session.add(incident)
    incident.confirmed = payload.get("confirmed", True)
    if incident.confirmed:
        incident.confirmed_at = dt.datetime.utcnow()


async def apply_alert(session: AsyncSession, payload: dict) -> None:
    session.add(
        Alert(
            ts=_parse_iso(payload["ts"]),
            machine_id=payload["machine_id"],
            operator_id=payload["operator_id"],
            type=payload["type"],
            severity=payload["severity"],
            message=payload.get("message", ""),
        )
    )


async def apply_telemetry_minute(session: AsyncSession, payload: dict) -> None:
    """The device's own 1-min telemetry aggregate (CLAUDE.md §3.1: mobile's lib/mqtt
    subscribes independently and uploads only 1-min summaries, never raw 1Hz frames),
    arriving through the outbox rather than straight off the broker. Mirrors
    app/services/mqtt_ingest.py's upsert exactly, so it lands in the same table whether
    the backend saw it directly from MQTT or via a device that was offline when the
    direct ingest worker would otherwise have caught it."""
    row = {
        "ts": _parse_iso(payload["ts"]),
        "machine_id": payload["machine_id"],
        "operator_id": payload["operator_id"],
        "site_id": payload.get("site_id", "SITE01"),
        "engine_on": bool(payload.get("engine_on", True)),
        "state": payload.get("state", "work"),
        "seatbelt": payload.get("seatbelt", "Fastened"),
        "swing_rate_dps": float(payload.get("swing_rate_dps", 0)),
        "travel_kmh": float(payload.get("travel_kmh", 0)),
        "reverse": bool(payload.get("reverse", False)),
        "fuel_rate_lph": float(payload.get("fuel_rate_lph", 0)),
        "nearest_person_m": payload.get("nearest_person_m"),
        "zone": payload.get("zone"),
    }
    dialect = engine.dialect.name
    insert_fn = pg_insert if dialect == "postgresql" else sqlite_insert
    stmt = insert_fn(TelemetryMinute).values(**row)
    update_cols = {c: getattr(stmt.excluded, c) for c in row if c not in ("ts", "machine_id")}
    stmt = stmt.on_conflict_do_update(index_elements=["ts", "machine_id"], set_=update_cols)
    await session.execute(stmt)


HANDLERS = {
    "task_status_update": apply_task_status_update,
    "idle_tag": apply_idle_tag,
    "incident_confirm": apply_incident_confirm,
    "alert": apply_alert,
    "telemetry_minute": apply_telemetry_minute,
}


async def apply_event(session: AsyncSession, event_type: str, payload: dict) -> None:
    handler = HANDLERS.get(event_type)
    if handler is not None:
        await handler(session, payload)
