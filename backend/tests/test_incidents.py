import datetime as dt

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Incident


async def _login(client: AsyncClient, role: str, operator_id: str | None = None) -> str:
    body = {"username": f"{role}_{operator_id or 'x'}_inc", "password": "pw12345", "role": role}
    if operator_id:
        body["operator_id"] = operator_id
    resp = await client.post("/auth/register", json=body)
    assert resp.status_code == 201
    return resp.json()["access_token"]


async def _seed_incident(
    db_session: AsyncSession, incident_id: str, operator_id: str, confirmed: bool
) -> None:
    db_session.add(
        Incident(
            id=incident_id,
            ts=dt.datetime.utcnow(),
            machine_id="EXC001",
            operator_id=operator_id,
            type="struck_by",
            severity="Near-miss",
            is_near_miss=True,
            trigger="red_zone_swing",
            confirmed=confirmed,
        )
    )
    await db_session.commit()


async def test_operator_cannot_see_another_operators_incidents(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    await _seed_incident(db_session, "INC_OTHER1", "OP2002", confirmed=True)
    token = await _login(client, "operator", "OP1001")

    resp = await client.get("/incidents", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert all(i["operator_id"] != "OP2002" for i in resp.json())


async def test_operator_sees_their_own_incident_fully(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    await _seed_incident(db_session, "INC_MINE1", "OP1001", confirmed=False)
    token = await _login(client, "operator", "OP1001")

    resp = await client.get("/incidents", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    mine = next(i for i in resp.json() if i["id"] == "INC_MINE1")
    assert mine["operator_id"] == "OP1001"


async def test_supervisor_sees_unconfirmed_incident_anonymized(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    await _seed_incident(db_session, "INC_UNCONF1", "OP1001", confirmed=False)
    token = await _login(client, "supervisor")

    resp = await client.get("/incidents", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    row = next(i for i in resp.json() if i["id"] == "INC_UNCONF1")
    assert row["operator_id"] is None  # Rule 2: not attributed unless the operator confirmed it


async def test_supervisor_sees_confirmed_incident_attributed(
    client: AsyncClient, seeded: dict, db_session: AsyncSession
) -> None:
    await _seed_incident(db_session, "INC_CONF1", "OP1001", confirmed=True)
    token = await _login(client, "supervisor")

    resp = await client.get("/incidents", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    row = next(i for i in resp.json() if i["id"] == "INC_CONF1")
    # the operator's own confirmation is the signal that allows attribution here
    assert row["operator_id"] == "OP1001"
