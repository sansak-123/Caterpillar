import datetime as dt

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SyncEvent, Task


async def _login_operator(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "username": "op1001",
            "password": "pw12345",
            "role": "operator",
            "operator_id": "OP1001",
        },
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


async def test_tasks_today_returns_seeded_task(client: AsyncClient, seeded: dict) -> None:
    token = await _login_operator(client)
    resp = await client.get("/tasks/today", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) == 1
    assert tasks[0]["task_id"] == "T1"


def _push_body(event_id: str, task_id: str, status: str, base_version: int) -> dict:
    return {
        "events": [
            {
                "event_id": event_id,
                "type": "task_status_update",
                "payload": {"task_id": task_id, "status": status, "base_version": base_version},
                "created_at": dt.datetime.utcnow().isoformat(),
                "device_id": "device-1",
                "attempt": 1,
            }
        ]
    }


async def test_push_same_batch_twice_is_idempotent(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    token = await _login_operator(client)
    headers = {"Authorization": f"Bearer {token}"}
    body = _push_body("evt-1", "T1", "in_progress", base_version=1)

    resp1 = await client.post("/sync/push", json=body, headers=headers)
    resp2 = await client.post("/sync/push", json=body, headers=headers)

    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json()["acked"] == ["evt-1"]
    assert resp2.json()["acked"] == ["evt-1"]

    event_count = await db_session.scalar(
        select(func.count()).select_from(SyncEvent).where(SyncEvent.event_id == "evt-1")
    )
    assert event_count == 1

    task = await db_session.get(Task, "T1")
    await db_session.refresh(task)
    assert task.status == "in_progress"
    assert task.version == 2  # incremented exactly once, not twice
    assert task.conflict is False


async def test_conflict_flagged_when_server_version_has_moved(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    token = await _login_operator(client)
    headers = {"Authorization": f"Bearer {token}"}

    # simulate the server having already moved the task on (e.g. a supervisor edit)
    task = await db_session.get(Task, "T1")
    task.version = 5
    await db_session.commit()

    # device still thinks it's at version 1 when it goes offline and changes status
    body = _push_body("evt-2", "T1", "in_progress", base_version=1)
    resp = await client.post("/sync/push", json=body, headers=headers)
    assert resp.status_code == 200

    await db_session.refresh(task)
    assert task.status == "in_progress"  # operator's status is kept, never silently discarded
    assert task.conflict is True
    assert task.version == 6
