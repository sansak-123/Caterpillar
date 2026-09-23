from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import Incident

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("")
async def list_incidents(
    operator_id: str | None = Query(default=None),
    is_near_miss: bool | None = Query(default=None),
    limit: int = Query(default=50, le=500),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    query = select(Incident).order_by(Incident.ts.desc()).limit(limit)
    if operator_id:
        query = query.where(Incident.operator_id == operator_id)
    if is_near_miss is not None:
        query = query.where(Incident.is_near_miss == is_near_miss)
    incidents = (await session.scalars(query)).all()
    return [
        {
            "id": i.id,
            "ts": i.ts.isoformat(),
            "machine_id": i.machine_id,
            "operator_id": i.operator_id,
            "type": i.type,
            "severity": i.severity,
            "is_near_miss": i.is_near_miss,
            "trigger": i.trigger,
            "root_cause_category": i.root_cause_category,
            "corrective_action": i.corrective_action,
            "confirmed": i.confirmed,
        }
        for i in incidents
    ]
