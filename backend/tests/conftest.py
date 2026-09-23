from __future__ import annotations

import datetime as dt
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 register all tables on Base.metadata
from app.db.session import Base, get_db
from app.main import app
from app.models import Machine, Operator, Site, Task


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    async with session_factory() as session:
        yield session

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def seeded(db_session: AsyncSession) -> dict:
    """Minimal fixture data: one site, one machine, one operator, one task — enough to
    exercise auth, /tasks/today and /sync push/pull without the full data pipeline."""
    site = Site(
        site_id="SITE01",
        name="Test Site",
        lat=0,
        lon=0,
        soil_type="clay",
        climate_profile="tropical_monsoon",
    )
    machine = Machine(
        machine_id="EXC001",
        machine_class="excavator",
        model_size_t=20,
        age_yrs=2,
        blind_spot_profile="rear_swing_blind",
        gps_enabled=True,
        idle_lph=4,
        work_lph=16,
        service_interval_hrs=500,
        hours_since_last_service=100,
    )
    operator = Operator(
        operator_id="OP1001",
        skill="Intermediate",
        persona="belt_skipper",
        language="en",
        shift="day",
        ghost_skill_factor=0.7,
    )
    task = Task(
        id="T1",
        task_id="T1",
        operator_id="OP1001",
        machine_id="EXC001",
        site_id="SITE01",
        task_type="Earth Excavation",
        scheduled_date=dt.date.today(),
        status="pending",
        est_min=60,
        p50_min=60,
        p90_min=75,
        weather_condition="Sunny",
        risk_band="safe",
        version=1,
        created_at=dt.datetime.utcnow(),
        updated_at=dt.datetime.utcnow(),
    )
    db_session.add_all([site, machine, operator, task])
    await db_session.commit()
    return {"site": site, "machine": machine, "operator": operator, "task": task}
