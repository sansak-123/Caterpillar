# OperatorOS — Smart Operator Assistant for CAT Machinery

A multi-functional operator companion for CAT excavator/loader operators: a daily task
dashboard, real-time offline-first safety alerts, an operator training hub (with a Unity-based
"Ghost Operator" simulator), unusual-behaviour detection, and ML-driven task time estimation.
See [CLAUDE.md](CLAUDE.md) for the full spec and [docs/BUILD_PROMPTS.md](docs/BUILD_PROMPTS.md)
for the phased build plan.

## Architecture at a glance
- **Mobile app** (`mobile/`) — React Native + Expo, offline-first, runs on the in-cab tablet.
- **Backend** (`backend/`) — FastAPI + PostgreSQL/TimescaleDB, sync + ML serving.
- **ML** (`ml/`) — task-time (LightGBM quantile), anomaly (IsolationForest), near-miss detection.
- **Simulator** (`simulator/`) — Python MQTT publisher standing in for real machine telemetry.
- **Unity sim** (`unity/OperatorSim/`) — the Ghost Operator / near-miss replay trainer.

## Run it in 3 commands (once Docker Desktop is installed and running)
```
docker compose up -d db mqtt api
python data/generators/run_all.py && python data/validate.py
cd mobile && npx expo start --dev-client
```

## Local dev (this environment — no Docker available)
Backend:
```
cd backend
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt
./.venv/Scripts/uvicorn app.main:app --reload
# in another shell:
./.venv/Scripts/pytest -q
```

Mobile:
```
cd mobile
npm install
npx expo start        # scan the QR with Expo Go, or press w for the web preview
```

## Commands
- `docker compose up -d db mqtt api` — infra + backend
- `python data/generators/run_all.py && python data/validate.py` — synthetic data
- `uvicorn app.main:app --reload` (in `backend/`) — API
- `python simulator/run.py --mode live|demo` — machine simulator
- `npx expo start --dev-client` (in `mobile/`) — run the app
- `eas build --profile development --platform android` — build a dev client with native modules
- `pytest backend/tests`, `npx jest` (in `mobile/`), `npx detox test` — tests

## Status
Phase 0 (scaffold) in progress — see [docs/BUILD_PROMPTS.md](docs/BUILD_PROMPTS.md) for what
comes next.
