from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    machine_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=500),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    query = select(Alert).order_by(Alert.ts.desc()).limit(limit)
    if machine_id:
        query = query.where(Alert.machine_id == machine_id)
    alerts = (await session.scalars(query)).all()
    return [
        {
            "id": a.id,
            "ts": a.ts.isoformat(),
            "machine_id": a.machine_id,
            "operator_id": a.operator_id,
            "type": a.type,
            "severity": a.severity,
            "message": a.message,
            "acknowledged": a.acknowledged,
        }
        for a in alerts
    ]
