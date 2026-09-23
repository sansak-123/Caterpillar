from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import Alert, IdleTag, Incident, Operator, Task

router = APIRouter(prefix="/operators", tags=["operators"])


@router.get("/{operator_id}/summary")
async def operator_summary(
    operator_id: str,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    operator = await session.get(Operator, operator_id)
    if operator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "operator not found")

    since = dt.datetime.utcnow() - dt.timedelta(days=7)
    alert_count = await session.scalar(
        select(func.count())
        .select_from(Alert)
        .where(Alert.operator_id == operator_id, Alert.ts >= since)
    )
    incident_count = await session.scalar(
        select(func.count())
        .select_from(Incident)
        .where(Incident.operator_id == operator_id, Incident.ts >= since)
    )
    idle_windows = (
        await session.scalars(
            select(IdleTag).where(IdleTag.operator_id == operator_id, IdleTag.ts_start >= since)
        )
    ).all()
    unjustified = sum(1 for w in idle_windows if w.reason == "unjustified")
    tasks_completed = await session.scalar(
        select(func.count())
        .select_from(Task)
        .where(Task.operator_id == operator_id, Task.status == "done")
    )

    return {
        "operator_id": operator.operator_id,
        "skill": operator.skill,
        "persona": operator.persona,
        "ghost_skill_factor": operator.ghost_skill_factor,
        "last_7_days": {
            "alerts": alert_count or 0,
            "incidents": incident_count or 0,
            "idle_windows": len(idle_windows),
            "idle_windows_unjustified": unjustified,
            "tasks_completed": tasks_completed or 0,
        },
    }
