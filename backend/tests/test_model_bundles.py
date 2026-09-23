from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

import app.api.model_bundles as model_bundles_module
from app.models import ModelBundle


async def _login_supervisor(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/register",
        json={"username": "sup_bundle", "password": "pw12345", "role": "supervisor"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


async def _login_operator(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "username": "op_bundle",
            "password": "pw12345",
            "role": "operator",
            "operator_id": "OP1001",
        },
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


@pytest.fixture
def registry_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(model_bundles_module, "REGISTRY_ROOT", tmp_path)
    return tmp_path


async def _seed_bundle(db_session: AsyncSession, registry_root: Path, version: str = "v1") -> None:
    bundle_dir = registry_root / "bundles" / version
    bundle_dir.mkdir(parents=True)
    (bundle_dir / "task_time_p50.onnx").write_bytes(b"fake-onnx-p50")
    (bundle_dir / "task_time_p90.onnx").write_bytes(b"fake-onnx-p90")
    db_session.add(
        ModelBundle(
            version=version,
            task_time_p50_uri=f"bundles/{version}/task_time_p50.onnx",
            task_time_p90_uri=f"bundles/{version}/task_time_p90.onnx",
            thresholds_json='{"a": 1}',
            feature_schema_json='{"features": ["x"]}',
        )
    )
    await db_session.commit()


async def test_register_requires_supervisor_or_trainer_role(
    client: AsyncClient, seeded: dict
) -> None:
    token = await _login_operator(client)
    resp = await client.post(
        "/model-bundles/register",
        json={
            "version": "v1",
            "task_time_p50_uri": "bundles/v1/task_time_p50.onnx",
            "task_time_p90_uri": "bundles/v1/task_time_p90.onnx",
            "thresholds_json": "{}",
            "feature_schema_json": "{}",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_download_bundle_file_returns_real_bytes(
    client: AsyncClient, seeded: dict, db_session: AsyncSession, registry_root: Path
) -> None:
    await _seed_bundle(db_session, registry_root)
    token = await _login_operator(client)

    resp = await client.get(
        "/model-bundles/v1/files/p50", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert resp.content == b"fake-onnx-p50"


async def test_download_unknown_artifact_name_is_404(
    client: AsyncClient, seeded: dict, db_session: AsyncSession, registry_root: Path
) -> None:
    await _seed_bundle(db_session, registry_root)
    token = await _login_operator(client)

    resp = await client.get(
        "/model-bundles/v1/files/not-a-real-artifact",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_download_unknown_version_is_404(client: AsyncClient, seeded: dict) -> None:
    token = await _login_operator(client)
    resp = await client.get(
        "/model-bundles/does-not-exist/files/p50",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_sync_pull_advertises_the_latest_bundle_with_download_urls(
    client: AsyncClient, seeded: dict, db_session: AsyncSession, registry_root: Path
) -> None:
    await _seed_bundle(db_session, registry_root)
    token = await _login_operator(client)

    resp = await client.get("/sync/pull", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    bundle = resp.json()["model_bundle"]
    assert bundle["version"] == "v1"
    assert bundle["task_time_p50_url"] == "/model-bundles/v1/files/p50"
    assert bundle["task_time_p90_url"] == "/model-bundles/v1/files/p90"
    assert bundle["feature_schema"] == {"features": ["x"]}
    assert bundle["thresholds"] == {"a": 1}
