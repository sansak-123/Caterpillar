import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alerts import router as alerts_router
from app.api.assistant import router as assistant_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.incidents import router as incidents_router
from app.api.model_bundles import router as model_bundles_router
from app.api.operators import router as operators_router
from app.api.predict import router as predict_router
from app.api.supervisor import router as supervisor_router
from app.api.sync import router as sync_router
from app.api.tasks import router as tasks_router
from app.db.seed_loader import ensure_seeded

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Keeps /tasks/today alive across real calendar days without a manual re-seed step —
    # see ensure_seeded()'s docstring. data/generated/*.csv is expected per CLAUDE.md
    # section 9's setup order (`run_all.py && validate.py` before starting the API); if
    # it's genuinely missing (e.g. a fresh clone, or CI), log and keep serving rather
    # than failing the whole API over demo-data seeding.
    try:
        await ensure_seeded()
    except FileNotFoundError:
        logger.warning("data/generated/*.csv not found — skipping demo-data seed; run data/generators/run_all.py")
    yield


app = FastAPI(title="OperatorOS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(assistant_router)
app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(alerts_router)
app.include_router(incidents_router)
app.include_router(operators_router)
app.include_router(supervisor_router)
app.include_router(sync_router)
app.include_router(predict_router)
app.include_router(model_bundles_router)
