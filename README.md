# OperatorOS — Smart Operator Assistant for CAT Machinery

A multi-functional operator companion for CAT excavator/loader operators, built against the
problem statement in [CLAUDE.md](CLAUDE.md) §1: a daily task dashboard, real-time offline-first
safety alerts, an operator training hub (Unity-based "Ghost Operator" simulator plus a real
lesson library), unusual-behaviour detection, and ML-driven task-time estimation — all reasoned
from real industrial standards (ISO 5006/16001/21815/3471/6683, SAE J1939, OSHA 29 CFR 1926.602,
NIOSH fatigue guidance), never claimed as real operational data. See
[docs/BUILD_PROMPTS.md](docs/BUILD_PROMPTS.md) for the phased build plan this was built against.

## Approach

Every feature is designed against the six USPs in CLAUDE.md §2 — Ghost Operator (tacit skill
capture), Near-Miss Autopilot, Idle Intent Tagging (protective but still answerable), a
condition-adaptive safety envelope, offline-first "safety never waits," and Whole-Machine Safety
Intelligence (fatigue, machine health, slope stability, an "are you okay?" check). None of this has
been validated with a real operator — it's reasoned from research and the standards above, and
that limitation is stated here plainly rather than hidden, per CLAUDE.md §2.1.

## Architecture at a glance
- **Mobile app** (`mobile/`) — React Native + Expo, the in-cab tablet UI.
- **Backend** (`backend/`) — FastAPI + Postgres/TimescaleDB (SQLite stand-in in this dev
  environment — see below), JWT auth, sync, ML serving, an OpenRouter-backed assistant.
- **ML** (`ml/`) — task-time (LightGBM quantile, exported to ONNX), anomaly (IsolationForest),
  near-miss hotspot analytics.
- **Simulator** (`simulator/`) — Python MQTT publisher standing in for real machine telemetry.
- **Unity sim** (`unity/OperatorSim/`) — the Ghost Operator / near-miss replay trainer.

```
MACHINE SIDE (simulated) → MQTT (Mosquitto) → IN-CAB DEVICE (React Native) ⇄ HTTPS ⇄ CLOUD (FastAPI, Postgres+Timescale, ML, OpenRouter)
```
Full diagram and module specs: CLAUDE.md §3, §6.

## Model results (real numbers, not aspirational)

| Model | Metric | Result |
|---|---|---|
| Task-time (LightGBM quantile, P50/P90) | MAE vs. planner baseline | **4.13 min** vs. 15.72 min baseline (**73.7% improvement**) |
| Task-time | P90 coverage | 84.7% (target ~90%) |
| Task-time → ONNX export | Max abs. diff vs. native | ~9×10⁻⁷ (well inside the 1e-4 parity bar) |
| Anomaly (IsolationForest, 15-min windows) | Precision / Recall | 0.55 / **0.07** — recall is genuinely weak; flagged here rather than hidden. The z-score/absolute-threshold device-side tier catches the seed-row cases directly; the cloud IsolationForest layer needs more tuning before it's a reliable second opinion. |

Full assumptions behind every synthetic column: [data/calibration.md](data/calibration.md).

## What's actually working today vs. what's still a gap

**Demoable now:**
- Daily task dashboard with live P50/P90 estimates and SHAP-derived reasons, pulled from the real
  backend (falls back to demo data if the backend isn't reachable).
- The core on-device safety engine — seatbelt, condition-adaptive proximity zones, near-miss
  detection, and the Rule 1 input-lockout gate — as pure, unit-tested TypeScript
  (`mobile/src/lib/safety/`) mirroring the Python rules 1:1, verified against the organiser's
  seed row (2025-05-01 10:00) on **both** sides per CLAUDE.md §8.
- USP-6 safety intelligence (fatigue, machine health, slope/rollover, "are you okay?"), the
  digital pre-start checklist, and the automatic end-of-shift log.
- An assistant with real voice input/output (on-device STT via `expo-speech-recognition`, TTS via
  `expo-speech`, en/hi/ta), backed by a real FastAPI endpoint that grounds answers in live task/
  alert data and only asks an LLM (Gemini via OpenRouter) to phrase/translate — with an honest
  offline fallback (MiniSearch KB) when there's no connection.
- Task-time and anomaly models, trained, evaluated, and exported to ONNX with a verified parity
  check.

**Known gaps (see docs/BUILD_PROMPTS.md phases for the original scope):**
- **Mobile offline-first foundation (Phase 4)** is a thin slice: a connectivity indicator and a
  dev "Cut network" toggle exist, but there's no on-device database (WatermelonDB/SQLite), no
  outbox/sync engine, no on-device MQTT subscriber, and no on-device ONNX inference yet — the app
  currently talks to the backend over plain REST, not the full offline-first contract in §3.1.
- **Supervisor & trainer views (Phase 6)** have real backend support (`/supervisor/overview`,
  `/ws/supervisor`) but no consuming mobile UI yet.
- **Unity (Phase 7)**: all C# scripts and the React Native bridge are written and reviewed
  (`unity/OperatorSim/README.md` has the exact remaining checklist), but nothing has been opened
  in a real Unity Editor — no scenes, prefabs, or builds exist yet. That work needs a human with
  Unity installed.
- **App-wide i18n** (`react-i18next`) isn't wired up; only the assistant has a working en/hi/ta
  switch today.
- The `simulator/` MQTT publisher and the mobile app aren't wired together yet — telemetry on the
  Safety screen today comes from the real `lib/safety` math run against fixed demo conditions
  with a toggle to flip machine state, not a live MQTT feed.

## Run it in 3 commands (once Docker Desktop is installed and running)
```
docker compose up -d db mqtt api
python data/generators/run_all.py && python data/validate.py
cd mobile && npx expo start --dev-client
```

## Local dev (this environment — no Docker available)
Backend (`backend/.env` already points `DATABASE_URL` at a seeded SQLite stand-in,
`backend/dev.db`, for exactly this reason):
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
npx expo start        # scan the QR with a custom dev client, or press w for the web preview
npx jest               # safety-engine + seed-row tests
```

## Commands
- `docker compose up -d db mqtt api` — infra + backend
- `python data/generators/run_all.py && python data/validate.py` — synthetic data
- `uvicorn app.main:app --reload` (in `backend/`) — API
- `python simulator/run.py --mode live|demo` — machine simulator
- `npx expo start --dev-client` (in `mobile/`) — run the app
- `eas build --profile development --platform android` — build a dev client with native modules
- `pytest -q` (in `backend/`), `npx jest` (in `mobile/`) — tests
