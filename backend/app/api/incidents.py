from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import Incident

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _serialize(incident: Incident, user: CurrentUser) -> dict:
    """CLAUDE.md §2.1 Rule 2: a near-miss surfaced to a supervisor/trainer reads as "a
    near-miss occurred, here's the context" — not attributed to an individual unless
    that operator has confirmed/annotated it themself. `confirmed` is exactly that
    operator-driven signal (USP-2: nothing is filed until the operator taps/says
    confirm), so it's the one case where revealing identity to non-operator roles is
    the operator's own choice, not a supervisor scoreboard."""
    reveal_operator = user.role == "operator" or incident.confirmed
    return {
        "id": incident.id,
        "ts": incident.ts.isoformat(),
        "machine_id": incident.machine_id,
        "operator_id": incident.operator_id if reveal_operator else None,
        "type": incident.type,
        "severity": incident.severity,
        "is_near_miss": incident.is_near_miss,
        "trigger": incident.trigger,
        "root_cause_category": incident.root_cause_category,
        "corrective_action": incident.corrective_action,
        "confirmed": incident.confirmed,
    }


@router.get("")
async def list_incidents(
    operator_id: str | None = Query(default=None),
    is_near_miss: bool | None = Query(default=None),
    limit: int = Query(default=50, le=500),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    query = select(Incident).order_by(Incident.ts.desc()).limit(limit)
    if user.role == "operator":
        # CLAUDE.md §3.2: "Operator sees own data only" — an operator's own filter
        # value (if any) is ignored in favor of their own id, never someone else's.
        query = query.where(Incident.operator_id == user.operator_id)
    elif operator_id:
        query = query.where(Incident.operator_id == operator_id)
    if is_near_miss is not None:
        query = query.where(Incident.is_near_miss == is_near_miss)
    incidents = (await session.scalars(query)).all()
    return [_serialize(i, user) for i in incidents]
