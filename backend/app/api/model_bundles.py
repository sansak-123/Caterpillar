from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.db.session import get_db
from app.models import ModelBundle
from app.schemas.model_bundle import ModelBundleRegisterRequest

router = APIRouter(prefix="/model-bundles", tags=["model-bundles"])


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("supervisor", "trainer"))],
)
async def register_bundle(
    body: ModelBundleRegisterRequest, session: AsyncSession = Depends(get_db)
) -> dict:
    """ml/registry/build_bundle.py calls this after training — CLAUDE.md section 3.1:
    the device pulls the latest bundle via /sync/pull's `model_bundle` field."""
    bundle = ModelBundle(
        version=body.version,
        task_time_p50_uri=body.task_time_p50_uri,
        task_time_p90_uri=body.task_time_p90_uri,
        thresholds_json=body.thresholds_json,
        feature_schema_json=body.feature_schema_json,
    )
    session.add(bundle)
    await session.commit()
    return {"version": bundle.version}
