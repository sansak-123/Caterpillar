from __future__ import annotations

import csv
import datetime as dt
import json
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import Machine, Task
from app.schemas.predict import PredictionResponse, TaskTimePredictRequest
from app.services.ml_service import get_task_time_model

router = APIRouter(tags=["predict"])

REPO_ROOT = Path(__file__).resolve().parents[3]
ANOMALY_ARTIFACTS = REPO_ROOT / "ml" / "anomaly" / "artifacts"
NEAR_MISS_ARTIFACTS = REPO_ROOT / "ml" / "near_miss" / "artifacts"


@router.post("/predict/task-time", response_model=PredictionResponse)
async def predict_task_time(
    body: TaskTimePredictRequest, user: CurrentUser = Depends(get_current_user)
) -> PredictionResponse:
    model = get_task_time_model()
    result = model.predict(body.model_dump(exclude={"est_min"}), body.est_min)
    return PredictionResponse(**result)


@router.get("/anomaly/operator/{operator_id}")
async def anomaly_for_operator(
    operator_id: str, user: CurrentUser = Depends(get_current_user)
) -> list[dict]:
    """Serves the batch-scored flags from ml/anomaly/train.py (IsolationForest is not
    re-run per request — this is the "weekly report" style output from CLAUDE.md
    section 6, not a live per-second model)."""
    path = ANOMALY_ARTIFACTS / "flagged_windows.csv"
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["operator_id"] == operator_id]
    return rows


@router.get("/nearmiss/hotspots")
async def nearmiss_hotspots(user: CurrentUser = Depends(get_current_user)) -> dict:
    path = NEAR_MISS_ARTIFACTS / "hotspots.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/tasks/day-plan")
async def day_plan(
    operator_id: str = Query(...),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Morning day-plan: pre-scores today's tasks for an operator with the task-time
    model. CLAUDE.md section 3.1: this is the pre-scored plan the device pulls at
    morning sync; offline re-scoring later uses the same ONNX bundle on-device."""
    model = get_task_time_model()
    today = dt.date.today()
    tasks = (
        await session.scalars(
            select(Task).where(Task.operator_id == operator_id, Task.scheduled_date == today)
        )
    ).all()

    plan = []
    for task in tasks:
        machine = await session.get(Machine, task.machine_id)
        features = {
            "task_type": task.task_type,
            "weather": task.weather_condition,
            "machine_age_yrs": machine.age_yrs if machine else None,
            "hours_since_last_service": machine.hours_since_last_service if machine else None,
            "hour_of_day": dt.datetime.utcnow().hour,
            "day_of_week": today.weekday(),
        }
        prediction = model.predict(features, task.est_min)
        plan.append(
            {
                "task_id": task.task_id,
                "task_type": task.task_type,
                "est_min": task.est_min,
                "p50_min": prediction["value"],
                "p90_min": prediction["range"][1],
                "reasons": prediction["reasons"],
            }
        )
    return plan
