from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, require_role
from app.db.session import get_db
from app.models import ModelBundle
from app.schemas.model_bundle import ModelBundleRegisterRequest

router = APIRouter(prefix="/model-bundles", tags=["model-bundles"])

# ml/registry/build_bundle.py writes files under here and stores paths in the DB
# relative to it (e.g. "bundles/v.../task_time_p50.onnx") — see that script's
# `bundle_meta.json` for the exact convention this mirrors.
REPO_ROOT = Path(__file__).resolve().parents[3]
REGISTRY_ROOT = REPO_ROOT / "ml" / "registry"

ARTIFACT_URI_FIELDS = {
    "p50": "task_time_p50_uri",
    "p90": "task_time_p90_uri",
}


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


@router.get("/{version}/files/{artifact}")
async def download_bundle_file(
    version: str,
    artifact: str,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> FileResponse:
    """CLAUDE.md §3.1: "Device downloads when online via expo-file-system." The device
    never sees a raw filesystem path — it only ever has `version` (from /sync/pull) and
    a fixed artifact name, and this resolves that to whatever the DB actually recorded."""
    if artifact not in ARTIFACT_URI_FIELDS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown artifact '{artifact}'")
    bundle = await session.get(ModelBundle, version)
    if bundle is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no such model bundle version")

    uri = getattr(bundle, ARTIFACT_URI_FIELDS[artifact])
    path = (REGISTRY_ROOT / uri).resolve()
    if REGISTRY_ROOT not in path.parents or not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "bundle file missing on disk")
    return FileResponse(path, media_type="application/octet-stream", filename=path.name)
