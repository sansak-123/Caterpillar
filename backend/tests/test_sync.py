import datetime as dt

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SyncEvent, Task, TelemetryMinute


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


async def test_push_survives_a_concurrent_duplicate_event_id(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    """Simulates the race two overlapping client-side sync drains hit: another request
    already committed a SyncEvent row with this event_id by the time this request's
    batch is processed. The old code raised a raw IntegrityError (500); it should now
    just ack it and move on, and — critically — still apply the OTHER events in the
    same batch rather than losing them to a whole-transaction rollback."""
    token = await _login_operator(client)
    headers = {"Authorization": f"Bearer {token}"}

    already_committed = SyncEvent(
        event_id="evt-dup",
        device_id="device-1",
        type="task_status_update",
        payload_json="{}",
        attempt=1,
        created_at=dt.datetime.utcnow(),
    )
    db_session.add(already_committed)
    await db_session.commit()

    body = {
        "events": [
            {
                "event_id": "evt-dup",
                "type": "task_status_update",
                "payload": {"task_id": "T1", "status": "in_progress", "base_version": 1},
                "created_at": dt.datetime.utcnow().isoformat(),
                "device_id": "device-1",
                "attempt": 1,
            },
            {
                "event_id": "evt-not-dup",
                "type": "task_status_update",
                "payload": {"task_id": "T1", "status": "done", "base_version": 1},
                "created_at": dt.datetime.utcnow().isoformat(),
                "device_id": "device-1",
                "attempt": 1,
            },
        ]
    }
    resp = await client.post("/sync/push", json=body, headers=headers)

    assert resp.status_code == 200
    assert set(resp.json()["acked"]) == {"evt-dup", "evt-not-dup"}
    task = await db_session.get(Task, "T1")
    await db_session.refresh(task)
    assert task.status == "done"  # the second, non-duplicate event still applied


async def test_telemetry_minute_event_upserts_by_ts_and_machine(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    """The mobile lib/mqtt subscriber's own 1-min aggregate, arriving through the
    outbox rather than the backend's direct MQTT ingest — CLAUDE.md §3.1."""
    token = await _login_operator(client)
    headers = {"Authorization": f"Bearer {token}"}
    ts = "2026-09-24T10:15:00.000Z"

    def _body(event_id: str, zone: str) -> dict:
        return {
            "events": [
                {
                    "event_id": event_id,
                    "type": "telemetry_minute",
                    "payload": {
                        "ts": ts,
                        "machine_id": "EXC001",
                        "operator_id": "OP1001",
                        "site_id": "SITE01",
                        "engine_on": True,
                        "state": "work",
                        "seatbelt": "Fastened",
                        "swing_rate_dps": 4.2,
                        "travel_kmh": 0.0,
                        "reverse": False,
                        "fuel_rate_lph": 14.5,
                        "nearest_person_m": 12.0,
                        "zone": zone,
                    },
                    "created_at": dt.datetime.utcnow().isoformat(),
                    "device_id": "device-1",
                    "attempt": 1,
                }
            ]
        }

    resp1 = await client.post("/sync/push", json=_body("tm-1", "green"), headers=headers)
    assert resp1.status_code == 200

    row = await db_session.get(
        TelemetryMinute,
        {"ts": dt.datetime.fromisoformat("2026-09-24T10:15:00+00:00"), "machine_id": "EXC001"},
    )
    assert row is not None
    assert row.zone == "green"

    # A second aggregate for the SAME minute (e.g. the app recomputed it) upserts in
    # place rather than creating a duplicate hypertable row.
    resp2 = await client.post("/sync/push", json=_body("tm-2", "amber"), headers=headers)
    assert resp2.status_code == 200

    count = await db_session.scalar(
        select(func.count())
        .select_from(TelemetryMinute)
        .where(TelemetryMinute.machine_id == "EXC001")
    )
    assert count == 1
    await db_session.refresh(row)
    assert row.zone == "amber"


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
