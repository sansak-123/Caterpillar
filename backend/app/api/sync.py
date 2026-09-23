from __future__ import annotations

import datetime as dt
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import ModelBundle, SyncEvent, Task
from app.schemas.sync import SyncPullResponse, SyncPushRequest, SyncPushResponse
from app.services.ws_manager import supervisor_manager
from app.sync.handlers import apply_event

LIVE_ALERT_EVENT_TYPES = {"alert", "incident_confirm"}

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushResponse)
async def push(
    body: SyncPushRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SyncPushResponse:
    """Idempotent by event_id: an event already present in sync_events is acked again
    but its handler is not re-run, so resending a batch (e.g. after a dropped response
    on a flaky connection) never double-applies a side effect."""
    acked: list[str] = []
    to_broadcast: list[dict] = []
    for event in body.events:
        already_seen = await session.scalar(
            select(SyncEvent).where(SyncEvent.event_id == event.event_id)
        )
        if already_seen is None:
            session.add(
                SyncEvent(
                    event_id=event.event_id,
                    device_id=event.device_id,
                    type=event.type,
                    payload_json=json.dumps(event.payload),
                    attempt=event.attempt,
                    created_at=event.created_at,
                )
            )
            await apply_event(session, event.type, event.payload)
            if event.type in LIVE_ALERT_EVENT_TYPES:
                to_broadcast.append({"type": event.type, "payload": event.payload})
        acked.append(event.event_id)

    await session.commit()
    for message in to_broadcast:
        await supervisor_manager.broadcast(message)
    return SyncPushResponse(acked=acked)


@router.get("/pull", response_model=SyncPullResponse)
async def pull(
    since: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SyncPullResponse:
    cursor_dt = dt.datetime.fromisoformat(since) if since else dt.datetime.min
    now = dt.datetime.utcnow()

    tasks_q = select(Task).where(Task.updated_at >= cursor_dt)
    if user.role == "operator" and user.operator_id:
        tasks_q = tasks_q.where(Task.operator_id == user.operator_id)
    tasks = (await session.scalars(tasks_q)).all()

    bundle = await session.scalar(select(ModelBundle).order_by(ModelBundle.published_at.desc()))

    return SyncPullResponse(
        cursor=now.isoformat(),
        tasks=[
            {
                "task_id": t.task_id,
                "operator_id": t.operator_id,
                "machine_id": t.machine_id,
                "task_type": t.task_type,
                "status": t.status,
                "est_min": t.est_min,
                "p50_min": t.p50_min,
                "p90_min": t.p90_min,
                "version": t.version,
                "conflict": t.conflict,
            }
            for t in tasks
        ],
        bookings=[],  # populated once Phase 6 booking flows exist
        training_assignments=[],  # populated once Phase 6 assignment flows exist
        model_bundle=(
            {"version": bundle.version, "published_at": bundle.published_at.isoformat()}
            if bundle
            else None
        ),
    )
