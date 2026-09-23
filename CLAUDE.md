# CLAUDE.md — Smart Operator Assistant for CAT Machinery ("OperatorOS")

Read this file fully before every task. It is the single source of truth.
If a request conflicts with this file, stop and ask.

---

## 1. Problem statement (verbatim scope — judges score against this)

Build a multi-functional, intelligent operator companion for CAT machine operators
(excavators, loaders) that improves efficiency, safety and training.

Expected outcomes — ALL five must be demoable:
1. **Daily task dashboard** — view scheduled tasks for the day.
2. **Safety features** — real-time operator safety using available/assumed data:
   seatbelt compliance, proximity hazards, incident logging. Working conditions must be considered.
3. **Operator training hub** — creative learning format: e-learning videos, instructor booking,
   or simulation module (we do all three; simulation is the hero).
4. **Unusual behaviour detection** — e.g. excessive idling, unsafe operation patterns.
5. **Task time estimation** — predict task duration from past data + environmental conditions.

Seed data given by organisers (MUST appear verbatim in generated data and tests):

telemetry_seed.csv
```
timestamp,machine_id,operator_id,engine_hours,fuel_used_l,load_cycles,idle_min,seatbelt_status,safety_alert
2025-05-01 08:00:00,EXC001,OP1001,1523.5,5.2,12,30,Fastened,No
2025-05-01 10:00:00,EXC001,OP1001,1524.8,3.8,2,55,Unfastened,Yes
2025-05-01 14:00:00,EXC001,OP1001,1526.5,6.1,10,15,Fastened,No
2025-05-02 09:00:00,EXC001,OP1001,1530.2,2.0,1,60,Unfastened,Yes
```

tasks_seed.csv
```
task_id,task_type,weather,operator_skill,machine_age_yrs,est_min,actual_min
T001,Earth Excavation,Sunny,Expert,2,60,58
T002,Trenching,Rainy,Intermediate,4,45,52
T003,Material Loading,Cloudy,Beginner,3,30,42
T004,Grading,Sunny,Expert,5,35,33
T005,Demolition,Windy,Intermediate,6,90,105
```

Known insights from seed data (use in demo narrative and tests):
- Row 10:00: engine ran 1.3 h (78 min) since prior reading, 55 min idle → ~70% idle, 2 load cycles,
  seatbelt unfastened. Unfastened belt co-occurs with high idle + low productivity (operator
  leaving seat with engine running).
- Task overrun ratio (actual/est): experts 0.94–0.97, rain 1.16, wind 1.17, beginner 1.40.
  → model predicts the OVERRUN RATIO, not raw minutes.

The seed schemas above are the **minimum contract** — the generated datasets carry many more
columns (section 5) to give the ML models real signal, but every seed row must still be
reproducible verbatim as a subset/projection of the richer generated tables.

---

## 2. Our differentiators (USPs) — every feature should serve these

**USP-1 Ghost Operator (tacit-knowledge capture).** Expert operators' cycle traces
(boom/stick/bucket/swing angles over time) are recorded from telemetry and replayed as a
translucent "ghost" excavator in the Unity simulator embedded natively in the mobile app.
Trainees dig alongside the ghost and are scored on cycle time, smoothness, fuel/cycle, idle.
As a trainee closes the gap, their measured skill factor updates and feeds the task-time model
→ estimates for that operator improve. Links outcome 3 ↔ outcome 5.

**USP-2 Near-Miss Autopilot.** The system passively detects near-miss signatures
(person inside amber/red zone while swinging or reversing; travel with belt unfastened; hard stop
after proximity alert) and creates a DRAFT incident automatically. Operator confirms with one tap
or one spoken word. Each confirmed near-miss becomes a replayable Unity scenario
("every near-miss becomes a lesson"). Links outcome 2 ↔ 3 ↔ 4.

**USP-3 Idle Intent Tagging.** Hour meters cannot tell productive standby from waste. When idle
exceeds 3 min, the app asks one-tap "why?" (waiting for truck / warm-up / break / other).
Anomaly detection then separates operator behaviour from site-planning problems
(e.g. truck bottleneck) — detection without blame.

**USP-4 Condition-adaptive safety envelope.** Proximity zone radii scale with visibility,
rain, wind, reverse/swing state and machine class. Working conditions feed safety, not just
estimates.

**USP-5 Offline-first, safety-never-waits.** All safety logic runs on the in-cab mobile device
with zero network dependency, using on-device sensors (GPS, motion) where the phone/tablet
provides them natively. Cloud is for learning, fleet view and sync.

Demo narrative arc (build the scripted demo around this):
10:00 seatbelt off + idle spike → idle intent prompt → worker enters blind-spot zone during swing
→ red alert → near-miss draft auto-logged → network cut (airplane mode), everything keeps
working, outbox grows → network back, sync flushes, supervisor view lights up → near-miss
assigned as Unity replay lesson → trainee runs Ghost Operator scenario → skill factor updates →
tomorrow's estimate for that operator tightens.

---

## 3. Architecture

```
MACHINE SIDE (simulated)                IN-CAB EDGE DEVICE (Android/iOS tablet, React Native)   CLOUD
┌──────────────────────┐   MQTT/WS    ┌──────────────────────────────────────┐  HTTPS   ┌─────────────────────┐
│ telemetry simulator   │────────────►│ mqtt.js subscriber (WS transport)     │◄───────►│ FastAPI              │
│ (Python, 1 Hz / 1 min)│  local LAN  │ Safety engine (TS, rules)             │  sync   │ Postgres+TimescaleDB │
│ proximity sensor sim  │             │ Anomaly-lite (TS, z-score)            │         │ Rules (server copy)  │
│ scripted demo scenes  │             │ Task-time ONNX (onnxruntime-react-    │         │ LightGBM + SHAP      │
└──────────────────────┘             │   native)                             │         │ IsolationForest      │
     Mosquitto broker                  │ Near-miss detector (TS)               │         │ Near-miss analytics  │
     (site gateway, TCP 1883 +          │ WatermelonDB (SQLite) + outbox        │         │ Claude API assistant │
      WS 9001)                         │ Background sync (expo-task-manager)   │         │ Model registry (ONNX)│
                                       │ Unity (native AAR/iOS framework)       │         │ Supervisor dashboard │
                                       │   embedded via native RN view          │         └─────────────────────┘
                                       │ Offline assistant (MiniSearch)         │
                                       │ Device sensors: GPS, accelerometer     │
                                       └──────────────────────────────────────┘
```

### 3.0 Mobile platform choice (decided — do not re-litigate without asking)
- **React Native, managed via Expo with a custom dev client** (not Expo Go — native modules for
  Unity, MQTT and ONNX require a custom dev client / `expo prebuild`). Targets Android first
  (CAT in-cab tablets are typically ruggedized Android devices), iOS as a stretch goal since the
  same codebase builds both.
- **Unity embedding — two-tier plan:**
  1. **Primary:** Unity exports a native Android AAR (and iOS framework if time allows); embed
     as a real native view via a Unity-for-RN bridge (e.g. a maintained fork of
     `react-native-unity-view` / `@azesmway/react-native-unity`), messaging through
     `UnityMessageManager` (`SendMessage` to a GameObject, `.jsx` listener for events back).
     Full native 3D performance — this is the "hero" simulation feature, worth the setup cost.
  2. **Fallback if native linking blows the schedule:** keep the Unity **WebGL** build and embed
     it in a `react-native-webview`, bridging with the same `postMessage`/`onMessage` pattern
     react-unity-webgl uses on the web. Slower and heavier, but zero native build risk — flip to
     this the moment Unity native linking threatens the demo date.
  Decide which tier is live per-build in `unity/README.md`; Phase 7 writes both bridge shims but
  only one is wired into the running app at a time.

### 3.1 Offline / online contract (NON-NEGOTIABLE)
- Safety alerts (seatbelt, proximity, near-miss draft) are computed ON DEVICE from local MQTT.
  They must never call the cloud. Test this with airplane mode / a dev "Cut network" toggle.
- Device state lives in on-device SQLite via **WatermelonDB** (reactive, sync-friendly) or
  `expo-sqlite` directly if WatermelonDB's schema migrations prove heavier than needed. Tables:
  `tasks`, `telemetry_buffer`, `alerts`, `incidents`, `idle_tags`, `training_progress`,
  `bookings`, `outbox`, `model_bundles`, `kb_docs`.
- **Outbox pattern:** every local write that must reach the cloud appends an event
  `{event_id: uuidv7, type, payload, created_at, device_id, attempt}` to `outbox`.
- **Sync engine:** triggers on network-state-change (via `@react-native-community/netinfo`), app
  foreground, a background task (`expo-task-manager` + `expo-background-fetch`, best-effort on
  iOS), and a 30 s retry loop with exponential backoff (max 5 min) while foregrounded. Batch up
  to 500 events per POST to `/sync/push`. Server upserts by `event_id` → idempotent, safe to
  resend.
- **Pull:** `/sync/pull?since=<cursor>` returns tasks, bookings, model bundle versions,
  training assignments. Cursor stored in WatermelonDB/SQLite.
- **Conflict rules:** telemetry, alerts, incidents, idle tags = append-only (no conflicts).
  Tasks = server-authoritative with `version`; if operator changed status offline and server
  version moved, keep operator's status, flag `conflict=true` for supervisor review.
- **Telemetry upload:** 1 Hz raw stays on device for 24 h; upload 1-min aggregates only.
- **Models:** cloud trains; publishes versioned bundle `{version, task_time.onnx,
  thresholds.json, feature_schema.json}`. Device downloads when online via `expo-file-system`,
  runs locally with onnxruntime-react-native. Day plan is pre-scored with full SHAP
  explanations at morning sync; offline re-scoring uses ONNX and marks explanation
  "approximate (offline)".
- **Assistant:** online → Claude API via backend. Offline → intent matcher + MiniSearch over
  cached safety cards, SOPs, and training snippets (bundled in the app + refreshed via sync). UI
  shows which mode is active.
- **UI:** a persistent connectivity pill (Online / Offline · N queued / Syncing) and a demo
  "Cut network" toggle in a dev-only screen (in addition to just testing via device airplane
  mode).
- App-shell assets (KB docs, offline-marked training videos, current model bundle) are bundled at
  build time where small, or downloaded on demand to `expo-file-system` document storage with a
  manifest row per file in WatermelonDB/SQLite — there is no service worker on native, so caching
  is an explicit download-and-track step, not implicit.

### 3.2 Security (keep light but visible)
- JWT auth, roles: `operator`, `supervisor`, `trainer`. Operator sees own data only.
- Device ID registered on first login; JWT + device token stored in `expo-secure-store`
  (Keychain/Keystore-backed), never AsyncStorage/plain SQLite. All sync calls signed with device
  token.
- System is READ-ONLY with respect to machine control. Never send commands to the machine.

---

## 4. Tech stack (do not substitute without asking)

| Layer | Choice |
|---|---|
| Mobile app | React Native + Expo (custom dev client / `expo prebuild`), TypeScript strict, **Expo Router** (file-based routing under `src/app/`, mandated by the Expo SDK 57 template's own AGENTS.md — routes are thin files that render screen components from `src/screens/`), Zustand, `react-native-svg` for icons and the safety radar view, `react-native-reanimated` for motion. NativeWind/Tamagui/RN Paper deferred — Phase 0 ships hand-rolled components against `src/theme/tokens.ts` (a dark, high-contrast, glove-friendly design system) via plain `StyleSheet`; layer a component/utility-class library later if desired, don't block on it. |
| Mobile offline/data | WatermelonDB (SQLite) or `expo-sqlite`, `uuidv7`, `expo-file-system` (asset/video caching), `expo-task-manager` + `expo-background-fetch` (background sync), `@react-native-community/netinfo` (connectivity), `expo-secure-store` (auth/device token) |
| Edge ML | `onnxruntime-react-native` (WASM/native execution providers) |
| Messaging | Eclipse Mosquitto (TCP 1883 + WebSockets 9001), `mqtt.js` on device over the WS transport (no raw TCP needed in RN), `aiomqtt` on server |
| 3D | Unity 2022.3 LTS (or Unity 6) → native Android AAR / iOS framework, embedded via a Unity-for-RN bridge (`UnityMessageManager`); WebGL + `react-native-webview` as fallback tier (§3.0). Blender only for rig fixes |
| Backend | FastAPI, SQLAlchemy 2.0, pydantic v2, Alembic |
| DB | PostgreSQL 16 + TimescaleDB (hypertable for telemetry) |
| ML | pandas, numpy, LightGBM (quantile), SHAP, scikit-learn (IsolationForest), onnxmltools/skl2onnx |
| Assistant | Anthropic Python SDK (check docs.claude.com for current model IDs; fast/cheap model for incident structuring, stronger model for explanations); voice via `expo-speech` (TTS) + `@react-native-voice/voice` or a cloud STT fallback |
| Offline search | MiniSearch (pure JS, runs fine in RN's JS engine) |
| i18n | `react-i18next` + `expo-localization` — English, Hindi, Tamil |
| Infra | Docker Compose: `db`, `mqtt`, `api`, `simulator` (the mobile app itself runs via Expo/EAS on device or emulator, not containerized) |
| Tests | pytest (backend), Jest + React Native Testing Library (mobile unit + safety/anomaly logic), Detox or Maestro (mobile offline e2e) |

---

## 5. Synthetic data — built on real industrial standards

No proprietary data exists publicly, so we generate our own. Every assumption is documented in
`data/calibration.md` with the standard/source it is based on. Never claim synthetic data is real.

Standards our schema and logic reference:
- ISO 15143-3 (AEMP 2.0 telematics) — field naming for hours, idle hours, fuel, location.
- ISO 5006 — operator field of view / blind spots for earth-moving machinery.
- ISO 16001 — object detection systems & visibility aids for earth-moving machinery.
- ISO 21815 — collision warning and avoidance for earth-moving machinery.
- ISO 6683 — seat belts for earth-moving machinery; ISO 3471 — ROPS.
- ISO 6165 — earth-moving machinery classification and vocabulary (machine class/attachment
  naming).
- SAE J1939 — CAN bus parameter groups for engine/powertrain diagnostics; grounds the added
  engine RPM, coolant temp, hydraulic temp, DEF level and fault-code fields below.
- OSHA 29 CFR 1926.602 — seatbelt requirement on earthmoving equipment.
- NIOSH guidance on extended/night shift fatigue — grounds the operator fatigue-score fields.
- CAT Performance Handbook — cycle-time / production-estimation methodology.

Calibration targets (tunable in `data/config.yaml`):
- Fleet idle ratio: fleet mean 25–40 % of engine hours; "idler" persona 55–75 %.
- Idle fuel burn 3–5 L/h by machine size; working burn several × idle.
- Personas: `disciplined`, `idler`, `belt_skipper`, `rusher` (short cycles, high swing speed,
  more proximity breaches), `learner` (improves over time).
- Skill → overrun multiplier centred on seed: expert ~0.95, intermediate ~1.08, beginner ~1.35.
- Weather multipliers centred on seed: sunny 1.0, cloudy 1.03, rainy ~1.15, windy ~1.15
  (demolition more wind-sensitive), plus continuous precip/wind/visibility effects.
- Machine age: +1–2 % per year above 3 yrs; maintenance debt (hours since last service) adds a
  smaller overrun and anomaly-risk multiplier.
- Fatigue: overrun and anomaly risk rise with hours-awake beyond 10 h and with consecutive
  night shifts, per NIOSH-style fatigue curves (documented assumption in calibration.md).
- Near-miss : incident ratio high (hundreds : 1 conceptually); incidents very rare.

### 5.1 Generated datasets (`data/generated/`) — expanded schema for ML signal

| File | Rows (default) | Key columns |
|---|---|---|
| machines.csv | 12 | machine_id, class (excavator/wheel_loader/dozer), model_size_t, engine_power_kw, bucket_capacity_m3, undercarriage_type (track/wheel), age_yrs, purchase_year, idle_lph, work_lph, fuel_tank_capacity_l, blind_spot_profile, gps_enabled, last_service_date, service_interval_hrs, hours_since_last_service, fault_code_history_count, avg_daily_utilization_hrs |
| operators.csv | 40 | operator_id, skill, years_exp, persona, language (en/hi/ta), shift, shift_number (day/night), certification_level, certification_expiry, hours_on_this_machine_model, hours_total_career, preferred_control_pattern (ISO/SAE), incident_history_count, training_completion_pct, ghost_skill_factor |
| sites.csv | 3 | site_id, name, lat, lon, elevation_m, terrain_type, soil_type, soil_bearing_capacity, site_area_hectares, climate_profile, timezone |
| weather_hourly.csv | 90 days × 3 sites | ts, site_id, temp_c, precip_mm, wind_kmh, visibility_m, humidity_pct, barometric_pressure_hpa, uv_index, dust_index, ground_moisture_pct, freeze_thaw_flag, daylight_flag, condition, monsoon_phase |
| telemetry_1min.parquet | ~90 days × 12 machines | ts, machine_id, operator_id, engine_on, state (work/idle/travel/off), engine_hours, engine_rpm, fuel_rate_lph, fuel_used_l, load_cycles, seatbelt, swing_rate_dps, boom_deg, stick_deg, bucket_deg, swing_deg, travel_kmh, reverse, hydraulic_pressure_bar, hydraulic_oil_temp_c, coolant_temp_c, battery_voltage_v, def_level_pct, payload_kg, ground_pressure_kpa, gps_lat, gps_lon, gps_heading, altitude_m, slope_pct, ambient_temp_c, vibration_rms, cabin_noise_db, fault_code_active, nearest_person_m, zone (green/amber/red), nearby_machines_count, gps_accuracy_m |
| telemetry_hourly.csv | aggregated | EXACT seed schema — seed rows included verbatim (this file stays a strict projection of the seed's 9 columns even though telemetry_1min carries the richer set above) |
| tasks.csv | 8,000 | seed schema + site_id, precip_mm, wind_kmh, visibility_m, temp_c, humidity_pct, soil_type, hour_of_day, day_of_week, is_holiday, planned_volume_m3, material_type, material_density_kg_m3, dig_depth_m, haul_distance_m, truck_wait_min, number_of_trucks, task_sequence_number_in_shift, operator_id, machine_id, hours_since_last_service, operator_fatigue_score_at_start, rest_hours_before_shift, previous_task_overrun_ratio (lag feature, same operator), site_congestion_index_at_start, number_of_nearby_workers, ppe_compliance_flag, pre_start_checklist_completed |
| cycle_traces.parquet | ~2,000 cycles | cycle_id, operator_id, skill, t, boom_deg, stick_deg, bucket_deg, swing_deg, phase (dig/swing_load/dump/swing_return), hydraulic_pressure_bar, payload_kg, fuel_burn_l |
| incidents.csv | ~40 incidents + ~1,500 near-misses | id, ts, machine_id, operator_id, type, severity, is_near_miss, trigger, weather_at_time, visibility_at_time_m, root_cause_category, corrective_action, near_miss_confidence_score, time_to_acknowledge_sec, context_json |
| schedule_today.csv | per operator | tasks for demo day |
| idle_tags.csv | labelled idle windows | window_id, reason (truck_wait/warmup/break/unjustified), gps_location, nearby_machines_count, queue_position_estimate |

Ground-truth labels (persona, injected anomalies, near-miss flags) are saved separately in
`data/generated/labels/` so detection can be evaluated with precision/recall.

### 5.2 Engineered / derived features (built in `data/generators/aggregate.py` and reused by `ml/`)

These are computed once during generation (and mirrored at inference time in `ml/task_time` and
`ml/anomaly`) so both training and serving see identical feature definitions:
- Per-operator rolling 7-day and 30-day idle ratio, rolling overrun-ratio average, EWMA of fuel
  per load cycle.
- Per-site rolling congestion index (active machines in the last hour within radius).
- Weather forecast-vs-actual delta (simulated forecast column vs realized), to let the model
  learn how much conditions can be trusted ahead of a task.
- Lag features: previous task's overrun ratio and idle ratio for the same operator.
- Time features: hour_of_day, day_of_week, is_holiday, shift_number.
- Maintenance debt: hours_since_last_service / service_interval_hrs.
- Fatigue score: function of hours-awake, consecutive night shifts, rest_hours_before_shift
  (documented curve in calibration.md, referencing NIOSH shift-work guidance).
Every ML output still returns `{value, range, reasons[]}` (section 8) — engineered features must
each be traceable to a plain-language SHAP reason string, not just raw model input.

---

## 6. Module specs

**Task dashboard:** today's tasks per operator with P50 & P90 minutes, weather badge, risk badge,
reorder, start/pause/complete; actual minutes recorded automatically from telemetry state.

**Safety engine (device, TS, pure functions, unit-tested with Jest):**
- `seatbelt`: alert if engine_on && (travel_kmh > 0.5 || swing_rate > 5) && seatbelt == unfastened
  for > 5 s. Soft reminder when engine_on && unfastened && idle.
- `proximity`: zone radii = base(machine_class) × condition_factor(visibility, precip, wind)
  × state_factor(swing, reverse). Red → loud alert + haptic (`expo-haptics`); amber → chime.
  Rear sector weighted higher (blind spot).
- `near_miss`: red-zone entry during swing/reverse, or belt-off travel, or hard-stop within
  2 s of a proximity alert → draft incident in WatermelonDB/SQLite + outbox.
- Working conditions panel: heat index, rain, wind, visibility, shift hours elapsed.

**Unusual behaviour (two tiers):**
- Device: rolling 15-min idle ratio vs operator baseline (z-score > 2) and absolute threshold;
  fuel per load cycle; belt violations/hour; hydraulic/coolant temp excursions.
- Cloud: IsolationForest on 15-min window features + per-operator baselines; weekly report
  separating "operator habit" vs "site bottleneck" using idle intent tags. Every flag carries a
  plain-language reason string.

**Task time estimation:** target = actual/est overrun ratio. LightGBM quantile models
(alpha 0.5 and 0.9). Features: task_type, skill, measured_skill_score (from training),
machine_age, hours_since_last_service, precip, wind, visibility, temp, humidity, soil,
material_type, dig_depth, haul_distance, hour, day_of_week, planned_volume, operator's 7-day
idle ratio, operator fatigue score, previous task overrun ratio, site congestion index.
Baseline = planner estimate. Report MAE on minutes vs baseline and P90 coverage.
Export to ONNX. SHAP top-3 factors as human sentences ("+9 min: rain", "+6 min: beginner").

**Training hub:** video library (downloadable for offline via `expo-file-system`), instructor
booking (slots, offline request queued), Unity simulator: scenarios `TrenchNearWorkers`,
`LoadingInRain`, `IdleDiscipline`, `GhostOperator`, `NearMissReplay(event_json)`. Scores posted to
backend; assignments come from anomaly + near-miss engines.

**Assistant:** voice/text. Intents: log incident, explain estimate, safety question,
"why was I flagged", book instructor. Online: Claude structures free speech into incident JSON
matching `IncidentSchema`. Offline: intent matcher + MiniSearch KB.

---

## 7. Repo layout

```
operator-os/
├── CLAUDE.md
├── docker-compose.yml
├── .env.example
├── data/
│   ├── seed/                 telemetry_seed.csv, tasks_seed.csv
│   ├── config.yaml           calibration knobs
│   ├── generators/           machines.py, operators.py, sites.py, weather.py, telemetry.py,
│   │                         tasks.py, cycles.py, incidents.py, aggregate.py, run_all.py
│   ├── validate.py           seed-row presence + distribution checks
│   ├── calibration.md
│   └── generated/            (gitignored except samples/)
├── simulator/                live MQTT publisher + scripted demo scenes
├── backend/
│   ├── app/ api/ core/ db/ models/ schemas/ services/ rules/ sync/ assistant/
│   ├── alembic/
│   └── tests/
├── ml/
│   ├── task_time/  anomaly/  near_miss/  export/  registry/
│   └── notebooks/            eda.ipynb, task_time_eval.ipynb, anomaly_eval.ipynb
├── mobile/                   React Native (Expo) app
│   ├── app.json / app.config.ts, eas.json
│   ├── src/app/              Expo Router routes (file-based): (tabs)/_layout.tsx +
│   │                         index.tsx (Today), safety.tsx, training.tsx, assistant.tsx —
│   │                         each route is a thin file rendering a screen component below
│   ├── src/screens/ components/ theme/ store/
│   │   lib/{db,sync,safety,anomaly,onnx,mqtt,kb,unity}/ i18n/
│   ├── android/ ios/         generated by `expo prebuild`, holds native Unity module linkage
│   └── e2e/                  Detox/Maestro specs
└── unity/OperatorSim/        Unity project (Assets/Scripts, Scenes, Prefabs)
    ├── BuildAndroid/         native AAR output copied into mobile/android/
    ├── BuildIOS/             native framework output copied into mobile/ios/
    └── BuildWebGL/           fallback tier (§3.0) copied into mobile assets if used
```

---

## 8. Conventions
- Python 3.11, ruff + black, type hints everywhere. TS strict, eslint, no `any`.
- Safety and anomaly rules are pure functions with unit tests using seed rows as fixtures.
- Seed row 2025-05-01 10:00 MUST trigger seatbelt + idle alerts in both TS and Python tests.
- Every ML output returns `{value, range, reasons[]}`.
- Env vars via `.env` (backend) and `app.config.ts` / EAS secrets (mobile); never commit keys.
  `ANTHROPIC_API_KEY` only on backend.
- Small commits per completed sub-task, conventional commit messages.
- When unsure about an industrial assumption, write it in calibration.md as an assumption.

## 9. Commands
- `docker compose up -d db mqtt api` — infra + backend
- `python data/generators/run_all.py && python data/validate.py` — data
- `uvicorn app.main:app --reload` (in backend/) — API
- `python simulator/run.py --mode live|demo` — machine simulator
- `npx expo start --dev-client` (in mobile/) — run the app (device/emulator with custom dev client)
- `eas build --profile development --platform android` — build a dev client with native modules
- `pytest backend/tests`, `npx jest` (in mobile/), `npx detox test` (or `maestro test`) — tests

## 10. Definition of done (per feature)
Works online AND offline (where applicable), has tests, has plain-language explanations,
is reachable in the demo script, and is documented in README.
