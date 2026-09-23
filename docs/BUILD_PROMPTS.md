# BUILD_PROMPTS.md — Copy-paste prompts for Claude Code

## How to run these
1. Create an empty folder `operator-os/`, put `CLAUDE.md` in the root, run `git init`, then `claude`.
2. One phase per session. Start each in **plan mode** (Shift+Tab), read the plan, correct it, then approve.
3. After each phase: run the acceptance checks yourself, commit, then `/clear` before the next phase.
4. Add a hook after Phase 2 so `pytest -q backend/tests` runs after edits to `backend/`.
5. If Claude drifts from the spec, say: "Re-read CLAUDE.md sections X and Y and fix."

---

## PHASE 0 — Scaffold

```
Read CLAUDE.md fully. Scaffold the repo exactly as in section 7.
- docker-compose.yml with: timescale/timescaledb (pg16), eclipse-mosquitto with a config that
  enables TCP 1883 and WebSockets 9001 (anonymous allowed in dev), api (FastAPI), simulator.
  Do NOT containerize the mobile app — it runs via Expo, not Docker.
- backend/: FastAPI app with /health, SQLAlchemy 2.0 async setup, Alembic initialised, pydantic settings.
- mobile/: Expo app with a custom dev client (`npx create-expo-app`, then `expo prebuild` so
  android/ and ios/ exist for later native module linking), TypeScript strict, NativeWind
  configured, React Navigation with a bottom tab bar with 4 tabs: Today, Safety, Training,
  Assistant (placeholder screens only), Zustand installed.
- data/seed/ with telemetry_seed.csv and tasks_seed.csv copied verbatim from CLAUDE.md.
- .env.example (backend), app.config.ts placeholders (mobile), .gitignore, README with the
  commands from section 9.
Do not implement features yet. Show me the tree when done.
```
Accept when: `docker compose up -d db mqtt api` works, `/health` returns ok, `npx expo start --dev-client` (in mobile/) shows 4 tabs on a device/emulator.

---

## PHASE 1 — Synthetic data engine

```
Read CLAUDE.md sections 1, 5. Build data/generators/ and data/validate.py.
Requirements:
- All knobs in data/config.yaml (fleet size, days, personas mix, multipliers, random seed).
- machines.py, operators.py, sites.py, weather.py: generate per section 5.1 table, including the
  expanded columns (engine specs, maintenance/service history, certification, fatigue-relevant
  fields, humidity/pressure/dust for weather). Weather is synthetic hourly with realistic
  persistence (rain comes in spells, not random per hour) and a monsoon-like wet season;
  condition label derived from continuous values.
- telemetry.py: 1-minute state machine per machine (off → warmup idle → work/idle/travel → off)
  driven by operator persona and assigned tasks. Cumulative engine_hours, fuel_used_l,
  load_cycles, plus the expanded sensor set from section 5.1 (engine_rpm, hydraulic pressure/
  temp, coolant temp, DEF level, battery voltage, payload, GPS lat/lon/heading, slope, vibration,
  cabin noise, fault codes) — ground these in SAE J1939 field semantics where applicable and note
  it in calibration.md. Seatbelt behaviour by persona. nearest_person_m from a simple
  worker-movement model; zone computed with the same condition-adaptive formula as the safety
  engine spec.  Inject labelled anomalies (idle spikes, belt-off travel, rushing, sensor
  excursions) into labels/.
- aggregate.py: produce telemetry_hourly.csv in EXACT seed schema (strict 9-column projection —
  do not add columns to this specific file). The 4 seed rows must be present verbatim at their
  timestamps for EXC001/OP1001 (force the generator to reproduce them). Also compute the rolling/
  lag engineered features from section 5.2 (per-operator rolling idle ratio and overrun average,
  site congestion index, fatigue score, maintenance debt, weather forecast-vs-actual delta) and
  write them alongside tasks.csv so ml/ and mobile inference share one feature definition.
- tasks.py: 8,000 tasks. actual = est × skill_mult × weather_mult × age_mult × maintenance_debt ×
  volume/soil/material effects × fatigue_mult × lognormal noise, centred so the 5 seed rows are
  typical. Include the full expanded column set from section 5.1 (material, dig depth, haul
  distance, truck wait, congestion, fatigue, previous-task lag feature, PPE/checklist flags).
  Include seed rows verbatim.
- cycles.py: parametric excavator dig cycles (dig → swing_load → dump → swing_return) as joint
  angle time series, plus hydraulic pressure, payload and fuel-burn-per-cycle columns. Experts:
  shorter, smoother (low jerk), consistent; beginners: longer, jerkier, higher variance, more
  pauses. Calibrate cycle durations with an assumption noted in calibration.md referencing the
  CAT Performance Handbook methodology.
- incidents.py: near-misses derived from telemetry (red-zone during swing/reverse, belt-off
  travel, hard stop after alert); a small number escalate to incidents. Types follow OSHA
  struck-by / caught-between / rollover categories. Include weather-at-time, root cause category,
  and confidence score columns from section 5.1.
- schedule_today.csv for the demo day.
- validate.py: asserts seed rows present in telemetry_hourly.csv and tasks.csv, fleet idle ratio
  within config band, per-persona stats sensible, overrun ratios by skill/weather close to seed,
  no unexplained nulls in the new sensor columns outside documented optional fields, prints a
  summary table and saves 4 matplotlib plots to data/generated/reports/.
- calibration.md: every assumption, its value, and which standard/method it is based on
  (including the new SAE J1939 and NIOSH-fatigue references from section 5).
Run everything and show me the validation summary.
```
Accept when: validate.py passes, seed rows found, plots look plausible.

---

## PHASE 2 — Backend core: ingest, DB, rules, sync

```
Read CLAUDE.md sections 3, 3.1, 6, 8. Build the backend core.
- Alembic migrations: machines, operators, sites, tasks (with version), telemetry_1min
  (Timescale hypertable, full expanded sensor columns from section 5.1), alerts, incidents,
  idle_tags, training_assignments, training_scores, bookings, model_bundles, devices, users,
  sync_events (event_id unique).
- Seed loader: loads data/generated into the DB.
- Ingest worker (aiomqtt): subscribes to site/+/machine/+/telemetry, writes 1-min aggregates.
- rules/: Python mirror of the safety + idle rules (pure functions). Tests using seed rows:
  2025-05-01 10:00 must trigger seatbelt and idle alerts; 08:00 and 14:00 must not.
- sync/: POST /sync/push (batch ≤500, idempotent upsert by event_id, returns acked ids),
  GET /sync/pull?since=cursor (tasks, bookings, assignments, latest model bundle meta).
  Task conflict rule exactly as CLAUDE.md 3.1.
- Auth: JWT with roles operator/supervisor/trainer, device registration endpoint.
- REST: /tasks/today, /alerts, /incidents, /operators/{id}/summary, /supervisor/overview.
- WebSocket /ws/supervisor for live alerts once synced.
Write pytest tests for rules, sync idempotency (push same batch twice → no duplicates), and
conflict handling.
```
Accept when: tests pass; pushing the same batch twice leaves counts unchanged.

---

## PHASE 3 — ML: task time, anomaly, near-miss, export

```
Read CLAUDE.md sections 5, 5.2, 6. Build ml/.
- task_time/: LightGBM quantile models (alpha 0.5, 0.9) predicting overrun ratio, using the full
  expanded + engineered feature set from sections 5.1/5.2 (maintenance debt, fatigue score,
  congestion index, previous-task lag, material/soil/dig-depth). Time-based split. Baseline =
  planner estimate. Report MAE (minutes) vs baseline, P90 coverage, and performance on each seed
  row. SHAP top-3 contributions converted to sentences.
- Export P50 and P90 models to ONNX; verify ONNX vs native predictions match within 1e-4.
  Write feature_schema.json (ordered features, categorical encodings, and which columns are
  optional/nullable for devices without a given sensor) for the mobile runtime
  (onnxruntime-react-native).
- anomaly/: 15-min window features (idle ratio, fuel per cycle, cycles per engine-hour, belt
  violations, swing-rate p95, off-hours, hydraulic/coolant temp excursions). Per-operator
  baseline z-scores + IsolationForest. Evaluate against labels/ with precision/recall. Output
  reason strings. Use idle_tags to split "operator habit" vs "site bottleneck (truck wait)".
- near_miss/: rule-based detector (same spec as device) + analytics: hotspots by site, time,
  machine sector (rear vs front), and conditions.
- registry/: build a versioned model bundle {version, task_time_p50.onnx, task_time_p90.onnx,
  thresholds.json, feature_schema.json} and register it via the backend API.
- Backend services: /predict/task-time (with SHAP reasons), /anomaly/operator/{id},
  /nearmiss/hotspots, and a morning "day plan" endpoint that pre-scores today's tasks.
- notebooks with clean plots for judges.
```
Accept when: model beats baseline MAE, ONNX parity test passes, anomaly recall reported.

---

## PHASE 4 — Mobile app foundation + offline layer

```
Read CLAUDE.md section 3, 3.0, 3.1 carefully. Build the offline foundation in mobile/.
- lib/db: WatermelonDB (or expo-sqlite) schema with all tables in 3.1, typed.
- lib/sync: outbox writer (uuidv7), sync engine (netinfo connectivity change, app foreground,
  expo-task-manager/expo-background-fetch background task, 30 s foreground retry loop,
  exponential backoff max 5 min, batch 500), pull with cursor, conflict flags. Expose a Zustand
  store: status (online/offline/syncing), queued count, last sync.
- lib/mqtt: mqtt.js client (WS transport) to ws://<gateway>:9001, subscribes to this machine's
  topic, writes 1 Hz frames to telemetry_buffer (24 h retention), builds 1-min aggregates into
  outbox.
- lib/onnx: loads current model bundle from device storage (expo-file-system, tracked in
  WatermelonDB/SQLite), runs P50/P90 with onnxruntime-react-native using feature_schema.json.
- Asset caching: no service worker on native — write an explicit download manager that fetches
  KB docs, offline-marked training videos, and the model bundle to expo-file-system, tracks each
  in a manifest table, and re-checks versions on sync.
- Connectivity pill in the header + dev-only screen with a "Cut network" toggle that forces
  offline mode in the sync engine and MQTT-to-cloud path (local MQTT keeps working); document
  that real device testing should also use airplane mode.
- Auth screen with operator login; device registration on first login; tokens in
  expo-secure-store.
- Detox (or Maestro) test: go offline (airplane mode / cut-network toggle), generate alerts and
  an incident, verify outbox count grows, go online, verify outbox drains and server has the
  events.
```
Accept when: the offline e2e test passes.

---

## PHASE 5 — Operator features: dashboard, safety, behaviour

```
Read CLAUDE.md sections 2 and 6. Build operator-facing screens. Tablet/phone-first,
glove-friendly: min 56 px touch targets, high contrast, dark theme default, large type.
- Today screen: tasks with P50–P90 range, weather/risk badges, start/pause/complete, reasons on
  tap. Pre-scored day plan from sync; offline rescoring via lib/onnx marked
  "approximate (offline)".
- lib/safety (pure TS, Jest tests mirroring Python tests incl. seed row 10:00): seatbelt,
  condition-adaptive proximity zones, near-miss draft creation.
- Safety screen: top-down radar view (react-native-svg) of machine with green/amber/red rings
  scaled by conditions and state, rear blind-spot sector highlighted, worker dots from telemetry;
  full-screen red alert with sound (expo-av) + vibration (expo-haptics); working conditions panel
  (heat, rain, wind, visibility, hours on shift).
- Near-Miss Autopilot: draft incident card "Near-miss detected — confirm?" with one-tap
  confirm/dismiss and optional voice note (expo-av recording). Stored in WatermelonDB + outbox.
- Idle Intent: after 3 min idle, non-blocking chip "Why idle?" → truck wait / warm-up /
  break / other. Saved as idle_tags.
- lib/anomaly: rolling 15-min idle ratio vs baseline, fuel per cycle, belt violations/hour;
  "Your shift" card with plain-language flags and trends.
- i18n with react-i18next + expo-localization: en, hi, ta for all operator-facing strings.
```
Accept when: running simulator in demo mode reproduces the 10:00 alerts on screen, offline (airplane mode).

---

## PHASE 6 — Supervisor & trainer views

```
Build role-based screens (same app, supervisor/trainer roles):
- Supervisor: fleet map/list of machines with live status, alert feed via /ws/supervisor,
  near-miss hotspot heatmap (by machine sector and site area), idle breakdown chart split by
  intent (habit vs truck wait), operator leaderboard for safety and efficiency, conflict queue
  for tasks edited offline.
- Trainer: assignments auto-generated from anomalies and near-misses (e.g. belt-skipper →
  IdleDiscipline; near-miss → NearMissReplay with event JSON), booking calendar with slots,
  trainee progress with Ghost scores over time.
- Training screen for operators: assigned lessons, video library with "download for offline",
  instructor booking (offline requests queued), Unity simulator launcher.
```
Accept when: a near-miss confirmed offline appears in supervisor view after reconnect and
generates a training assignment.

---

## PHASE 7 — Unity simulator + mobile bridge

Note: Claude Code writes the C# and the React Native bridge. You do the Editor work manually:
import the excavator model, check the boom/stick/bucket pivots (fix in Blender if needed),
attach scripts, bake NavMesh, configure the Android/iOS export settings, and build the native
library into `unity/OperatorSim/BuildAndroid` / `BuildIOS` (or `BuildWebGL` if using the fallback
tier from CLAUDE.md §3.0).

```
Read CLAUDE.md sections 2, 3.0 and 6 (Training hub). In unity/OperatorSim write C# scripts and
give me a step-by-step Editor checklist for everything you cannot do from code, including which
Unity export settings differ between the native Android/iOS tier and the WebGL fallback tier.
Scripts:
- ExcavatorRig.cs: boom/stick/bucket/swing joints with angle limits and speeds; keyboard +
  on-screen touch joysticks; ISO/SAE control pattern toggle.
- TelemetryDriver.cs: LiveTwin mode, animates the rig from JSON received from React Native.
- GhostPlayer.cs: loads a cycle trace JSON (from cycle_traces) and replays it on a translucent
  duplicate rig in sync with the trainee's cycle start.
- Scoring.cs: cycle time, jerk (smoothness), idle seconds, zone breaches, fuel estimate;
  compares to ghost; emits a score JSON at scenario end.
- WorkerAgent.cs: NavMesh workers with patrol paths; some paths cross the rear blind spot.
- ProximityZones.cs: rings that scale with a condition factor passed from React Native; red/amber
  materials; triggers breach events.
- WeatherFX.cs: rain particles, fog for visibility, wind affecting dust.
- ScenarioManager.cs: TrenchNearWorkers, LoadingInRain, IdleDiscipline, GhostOperator,
  NearMissReplay(event_json) which reconstructs worker positions and machine state.
- Native bridge (primary tier): a `UnityMessageManager`-compatible receiver GameObject/script
  that accepts JSON messages from React Native (scenario config, ghost traces, conditions) and
  emits score/event JSON back through the same channel.
- WebGL bridge (fallback tier): ReactBridge.cs + Plugins/WebGL/Bridge.jslib, receiving via
  SendMessage("Bridge", ...) and sending events back through the standard WebGL→JS message
  channel, for use inside a react-native-webview.
React Native side: mobile/src/components/UnitySim.tsx that renders either
(a) the native Unity view component (primary tier) with a typed `sendToUnity`/`onUnityMessage`
wrapper, or
(b) a react-native-webview loading the WebGL build with the same message-shaped API (fallback
tier) — same TypeScript interface either way so screens don't care which tier is active.
Sending scenario config/ghost traces/conditions, receiving scores → WatermelonDB + outbox.
Keep the Unity build size small (compressed textures, low-poly site) for both tiers.
```
Accept when: the Ghost scenario runs on-device, offline, and the score shows in the Training
screen — on whichever tier (native or WebGL fallback) is currently wired in per §3.0.

---

## PHASE 8 — Assistant (online + offline)

```
Read CLAUDE.md section 3.1 (assistant) and 6. Build the assistant.
- Backend /assistant/chat using the Anthropic Python SDK. System prompt: in-cab CAT operator
  assistant, short answers, safety-first, never gives machine control commands, answers in
  the operator's language (en/hi/ta).
- /assistant/incident: free speech/text → strict JSON matching IncidentSchema (type, severity,
  location, machine, people_involved, description). Validate with pydantic; retry once on
  invalid JSON.
- "Explain my estimate" and "Why was I flagged" use SHAP reasons / anomaly reasons as context.
- Mobile: Assistant screen with push-to-talk (`@react-native-voice/voice` for STT, `expo-speech`
  for TTS, text fallback), large quick-action buttons (Log incident, Explain estimate, Safety
  help, Book instructor).
- Offline mode: intent matcher (keyword + fuzzy) + MiniSearch over kb_docs (safety cards, SOPs,
  training summaries I will write in mobile/src/kb/*.md, bundled + synced). Incidents created
  offline use a guided 3-step form and are queued.
- Mode badge: "Cloud assistant" vs "Offline assistant".
```
Accept when: voice-logged incident produces valid JSON online, and offline the guided flow
queues it.

---

## PHASE 9 — Demo mode + judge polish

```
Read CLAUDE.md section 2 (demo narrative arc). Build a scripted demo.
- simulator --mode demo plays a 6-minute scene reproducing the seed rows and the full arc:
  belt off + idle spike → idle intent prompt → worker enters rear blind spot during swing →
  red alert → near-miss auto-draft → (presenter flips airplane mode / the dev Cut network
  toggle) → actions queue → reconnect → sync flush → supervisor view updates → assignment
  created → Ghost scenario → skill score updates → re-scored estimate for tomorrow shows
  tighter range.
- A presenter screen (dev only) with buttons to jump to each beat.
- README for judges: problem → approach → architecture diagram → data & standards
  (link calibration.md) → model results table → offline design → how to run in 3 commands
  (including how to install the Expo dev client build on a demo device).
- Seed a clean demo DB snapshot so the demo is reproducible.
Rehearse the flow end to end and list any flaky steps for me to fix.
```
Accept when: the whole arc runs twice in a row without manual fixes.

---

## Fallback priority if time runs short
1 → 2 → 4 → 5 (safety + dashboard) → 3 (task time only) → 9 (demo) → 7 (Ghost only, WebGL
fallback tier if native Unity linking is behind) → 6 → 8.
The offline safety demo and the seed-row 10:00 alert are the minimum winning slice.
