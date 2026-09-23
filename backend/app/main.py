from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alerts import router as alerts_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.incidents import router as incidents_router
from app.api.operators import router as operators_router
from app.api.supervisor import router as supervisor_router
from app.api.sync import router as sync_router
from app.api.tasks import router as tasks_router

app = FastAPI(title="OperatorOS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(alerts_router)
app.include_router(incidents_router)
app.include_router(operators_router)
app.include_router(supervisor_router)
app.include_router(sync_router)
