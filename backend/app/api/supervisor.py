from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.db.session import get_db
from app.models import Incident, Task
from app.services.ws_manager import supervisor_manager

router = APIRouter(tags=["supervisor"])


@router.get("/supervisor/overview", dependencies=[Depends(require_role("supervisor", "trainer"))])
async def supervisor_overview(session: AsyncSession = Depends(get_db)) -> dict:
    today = dt.date.today()
    status_counts = dict(
        (
            await session.execute(
                select(Task.status, func.count())
                .where(Task.scheduled_date == today)
                .group_by(Task.status)
            )
        ).all()
    )
    conflict_count = await session.scalar(
        select(func.count()).select_from(Task).where(Task.conflict.is_(True))
    )
    open_near_misses = await session.scalar(
        select(func.count())
        .select_from(Incident)
        .where(Incident.is_near_miss.is_(True), Incident.confirmed.is_(False))
    )

    return {
        "today_task_status": status_counts,
        "tasks_with_conflict": conflict_count or 0,
        "unconfirmed_near_misses": open_near_misses or 0,
    }


@router.websocket("/ws/supervisor")
async def ws_supervisor(websocket: WebSocket) -> None:
    await supervisor_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keepalive / ignored client pings
    except WebSocketDisconnect:
        supervisor_manager.disconnect(websocket)
