from httpx import AsyncClient


async def _login(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/register",
        json={"username": "predictor", "password": "pw12345", "role": "supervisor"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


async def test_predict_task_time_returns_value_range_reasons(client: AsyncClient) -> None:
    token = await _login(client)
    body = {
        "est_min": 60,
        "task_type": "Earth Excavation",
        "operator_skill": "Expert",
        "weather": "Sunny",
        "machine_age_yrs": 2,
    }
    resp = await client.post(
        "/predict/task-time", json=body, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "value" in data
    assert len(data["range"]) == 2
    assert data["range"][0] <= data["range"][1]
    assert len(data["reasons"]) == 3
