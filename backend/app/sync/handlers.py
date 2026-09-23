"""Applies the business-logic side effect of one outbox event — called exactly once
per event_id (the caller in app/api/sync.py checks sync_events for that guarantee), so
handlers don't need to be idempotent themselves.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, IdleTag, Incident, Task


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
            ts_start=dt.datetime.fromisoformat(payload["ts_start"]),
            ts_end=dt.datetime.fromisoformat(payload["ts_end"]),
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
            ts=dt.datetime.fromisoformat(payload["ts"]),
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
            ts=dt.datetime.fromisoformat(payload["ts"]),
            machine_id=payload["machine_id"],
            operator_id=payload["operator_id"],
            type=payload["type"],
            severity=payload["severity"],
            message=payload.get("message", ""),
        )
    )


HANDLERS = {
    "task_status_update": apply_task_status_update,
    "idle_tag": apply_idle_tag,
    "incident_confirm": apply_incident_confirm,
    "alert": apply_alert,
}


async def apply_event(session: AsyncSession, event_type: str, payload: dict) -> None:
    handler = HANDLERS.get(event_type)
    if handler is not None:
        await handler(session, payload)
