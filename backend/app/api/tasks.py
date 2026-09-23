from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import Task

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/today")
async def tasks_today(
    user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db)
) -> list[dict]:
    today = dt.date.today()
    query = select(Task).where(Task.scheduled_date == today)
    if user.role == "operator" and user.operator_id:
        query = query.where(Task.operator_id == user.operator_id)
    tasks = (await session.scalars(query.order_by(Task.created_at))).all()

    return [
        {
            "task_id": t.task_id,
            "task_type": t.task_type,
            "status": t.status,
            "est_min": t.est_min,
            "p50_min": t.p50_min,
            "p90_min": t.p90_min,
            "weather_condition": t.weather_condition,
            "risk_band": t.risk_band,
            "machine_id": t.machine_id,
            "version": t.version,
            "conflict": t.conflict,
        }
        for t in tasks
    ]
