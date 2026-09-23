"""Loads data/generated/*.csv into the DB — CLAUDE.md section 9's `run_all.py &&
validate.py` step is expected to have already run. Core reference + operational tables
only (machines/sites/operators/tasks); historical telemetry/incidents/idle_tags are the
live ingest worker's job going forward, not a one-time seed load.

Run as `python -m app.db.seed_loader` from backend/, with the repo's data/generated/
already populated.
"""

from __future__ import annotations

import asyncio
import datetime as dt
from pathlib import Path

import pandas as pd
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.db.session import async_session_factory, engine
from app.models import Machine, Operator, Site, Task

DATA_GENERATED = Path(__file__).resolve().parents[3] / "data" / "generated"


def _upsert_stmt(model, rows: list[dict]):
    dialect = engine.dialect.name
    insert_fn = pg_insert if dialect == "postgresql" else sqlite_insert
    stmt = insert_fn(model).values(rows)
    pk_cols = [c.name for c in model.__table__.primary_key.columns]
    update_cols = {
        c.name: getattr(stmt.excluded, c.name)
        for c in model.__table__.columns
        if c.name not in pk_cols
    }
    return stmt.on_conflict_do_update(index_elements=pk_cols, set_=update_cols)


async def _load_machines(session) -> int:
    df = pd.read_csv(DATA_GENERATED / "machines.csv").rename(columns={"class": "machine_class"})
    rows = [
        {
            "machine_id": r.machine_id,
            "class": r.machine_class,
            "model_size_t": r.model_size_t,
            "age_yrs": r.age_yrs,
            "blind_spot_profile": r.blind_spot_profile,
            "gps_enabled": bool(r.gps_enabled),
            "idle_lph": r.idle_lph,
            "work_lph": r.work_lph,
            "service_interval_hrs": r.service_interval_hrs,
            "hours_since_last_service": r.hours_since_last_service,
        }
        for r in df.itertuples()
    ]
    await session.execute(_upsert_stmt(Machine, rows))
    return len(rows)


async def _load_sites(session) -> int:
    df = pd.read_csv(DATA_GENERATED / "sites.csv")
    rows = [
        {
            "site_id": r.site_id,
            "name": r.name,
            "lat": r.lat,
            "lon": r.lon,
            "soil_type": r.soil_type,
            "climate_profile": r.climate_profile,
            "timezone": r.timezone,
        }
        for r in df.itertuples()
    ]
    await session.execute(_upsert_stmt(Site, rows))
    return len(rows)


async def _load_operators(session) -> int:
    df = pd.read_csv(DATA_GENERATED / "operators.csv")
    rows = [
        {
            "operator_id": r.operator_id,
            "skill": r.skill,
            "persona": r.persona,
            "language": r.language,
            "shift": r.shift,
            "ghost_skill_factor": r.ghost_skill_factor,
        }
        for r in df.itertuples()
    ]
    await session.execute(_upsert_stmt(Operator, rows))
    return len(rows)


async def _load_schedule_today(session) -> int:
    """Seeds the demo-day schedule (schedule_today.csv) as real Task rows, since that's
    what /tasks/today actually serves — the full 90-day tasks.csv is for ML training,
    not for populating the live tasks table.

    schedule_today.csv bakes in whatever `config.demo_day` was at generation time
    (2025-05-01) — but /tasks/today filters on the real current date, so a straight
    import would silently show nothing. "Today's schedule" should always mean today,
    so we override scheduled_date to the actual current date on load rather than
    trusting the CSV's frozen demo date.
    """
    today = dt.date.today()
    df = pd.read_csv(DATA_GENERATED / "schedule_today.csv")
    rows = [
        {
            "id": r.task_id,
            "task_id": r.task_id,
            "operator_id": r.operator_id,
            "machine_id": r.machine_id,
            "site_id": r.site_id,
            "task_type": r.task_type,
            "scheduled_date": today,
            "status": "pending",
            "est_min": r.est_min,
            "p50_min": r.est_min,
            "p90_min": round(r.est_min * 1.25, 1),
            "actual_min": None,
            "weather_condition": r.weather,
            "risk_band": "danger" if r.weather in ("Rainy", "Windy") else "safe",
            "version": 1,
            "conflict": False,
            "created_at": dt.datetime.utcnow(),
            "updated_at": dt.datetime.utcnow(),
        }
        for r in df.itertuples()
    ]
    await session.execute(delete(Task))
    await session.execute(_upsert_stmt(Task, rows))
    return len(rows)


async def load_all() -> dict[str, int]:
    counts: dict[str, int] = {}
    async with async_session_factory() as session:
        counts["machines"] = await _load_machines(session)
        counts["sites"] = await _load_sites(session)
        counts["operators"] = await _load_operators(session)
        counts["tasks"] = await _load_schedule_today(session)
        await session.commit()
    return counts


if __name__ == "__main__":
    result = asyncio.run(load_all())
    for name, count in result.items():
        print(f"[seed_loader] {name}: {count} rows")
