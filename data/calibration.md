# calibration.md — documented assumptions behind the synthetic data

Every generator appends its own section here when run. See CLAUDE.md section 5
for the standards each assumption is grounded in.

## Fleet (machines.csv)
<!-- section:Fleet (machines.csv):start -->
- Fleet mix: 6 excavators / 4 wheel loaders / 2 dozers (12 total), per CLAUDE.md section 5.1.
- `blind_spot_profile` follows ISO 5006 (operator field of view) — excavators get a rear swing blind spot, wheel loaders a front bucket blind spot, dozers a wide rear blind spot.
- `idle_lph`/`work_lph` sampled to land in the fleet idle-fuel-burn band from CLAUDE.md section 5 (idle 3-5 L/h, work 3-6x idle).
- `last_service_date` is backed out from `hours_since_last_service` assuming ~8 operating hours/day fleet-wide — an assumption, not measured data.
- EXC001 is pinned to age_yrs=2 and class=excavator so it matches telemetry_seed.csv verbatim.
<!-- section:Fleet (machines.csv):end -->

## Sites (sites.csv)
<!-- section:Sites (sites.csv):start -->
- 3 sites across India (matches the en/hi/ta i18n scope), each given a distinct `climate_profile` so weather.py can vary monsoon intensity and dust/visibility baselines per site rather than using one national average.
- `soil_bearing_capacity` (kPa) is a coarse per-soil-type constant, not a geotechnical survey — used only to perturb task time via soil effects.
<!-- section:Sites (sites.csv):end -->

## Operators (operators.csv)
<!-- section:Operators (operators.csv):start -->
- Skill mix 30/45/25 Beginner/Intermediate/Expert; persona mix from `data/config.yaml.personas.mix`.
- `ghost_skill_factor` (USP-1) is a synthetic 0-1 proxy for how close an operator's cycle trace is to the expert ghost — sampled by skill band here, and intended to move over time as an operator completes Ghost Operator scenarios (not modeled as a time series in this generator pass).
- OP1001 is pinned to persona=belt_skipper, skill=Intermediate so the seed's 10:00/next-day-09:00 unfastened-belt + high-idle rows read as in-character rather than anomalous noise.
<!-- section:Operators (operators.csv):end -->

## Weather (weather_hourly.csv)
<!-- section:Weather (weather_hourly.csv):start -->
- Rain persistence modeled as a 2-state Markov chain per site (P(stay wet)=0.8), so spells last multiple hours instead of hour-to-hour independence — a documented simplification, not fit to real station data.
- Each site gets its own contiguous monsoon window (~30-40% of the 90-day run) with an elevated hourly wet-transition probability, loosely standing in for the Indian monsoon season referenced in CLAUDE.md section 5.
- `condition` (Sunny/Cloudy/Rainy/Windy) is derived from the continuous columns with fixed thresholds (precip>0.5mm -> Rainy, wind>25km/h -> Windy, humidity>75% -> Cloudy, else Sunny) to match the categorical values used in tasks_seed.csv.
<!-- section:Weather (weather_hourly.csv):end -->

## Telemetry (telemetry_1min.parquet)
<!-- section:Telemetry (telemetry_1min.parquet):start -->
- Off-shift minutes are not emitted at all (sparse-logging convention) — every row has engine_on=True. `off` remains a valid value of `state` for downstream code, it just never appears in this generated table.
- Idle ratio targets per persona come from CLAUDE.md section 5 (disciplined ~15%, idler ~65%, belt_skipper ~35%, rusher ~12%); `learner` decreases linearly from ~45% to ~20% across the 90-day run to represent improving skill (USP-1 Ghost Operator).
- Seatbelt status is decided once per contiguous segment (not per minute) so it reads as one coherent event rather than per-minute flicker.
- `hydraulic_oil_temp_c`/`coolant_temp_c` follow a simple warm-up curve (1 - e^(-t/25min)) toward a fixed equilibrium from the hour's ambient temperature — a first-order approximation, not a thermal model.
- `def_level_pct` is a deterministic 20-day sawtooth (refill every 20 days) rather than usage-linked depletion — documented simplification.
- Proximity `zone` uses a simplified condition factor (visibility + wind only) on top of fixed 9m/20m red/amber base radii; the full condition-adaptive formula (machine class, swing/reverse state factor) is the device-side safety engine's job in Phase 5, this table only needs plausible history + labels.
- EXC001 is forced to be operated by OP1001 on 2025-05-01 and 2025-05-02 so this table's narrative matches telemetry_seed.csv even though the seed rows themselves are injected verbatim only into telemetry_hourly.csv (aggregate.py) — reconciling exact seed values against a live minute-level simulation isn't attempted, per the Phase 1 brief's 'force the generator to reproduce them' instruction.
- Injected, labelled anomalies (`data/generated/labels/telemetry_anomalies.csv`): `idle_spike` (one oversized idle segment per triggered machine-day), `belt_off_travel` (seatbelt unfastened during a travel segment), and `rushing` (flagged for the whole machine-day when persona=rusher) — for ml/anomaly precision/recall evaluation in Phase 3.
<!-- section:Telemetry (telemetry_1min.parquet):end -->

## Tasks (tasks.csv)
<!-- section:Tasks (tasks.csv):start -->
- `actual_min = est_min x skill_mult x weather_mult x age_mult x maintenance_mult x soil_mult x fatigue_mult x lognormal(0, 0.07)`, multipliers from `data/config.yaml.overrun_multiplier` (values centred on the seed's per-skill/weather ratios in CLAUDE.md section 1).
- The 5 seed rows keep their exact task_id/task_type/weather/operator_skill/machine_age_yrs/est_min/actual_min; only the expanded columns around them are synthesized (a matching operator/machine/site is sampled, numeric weather fields are drawn conditioned on the seed's categorical weather).
- `planned_volume_m3` is back-derived from est_min via a fixed per-task-type throughput rate (loosely CAT Performance Handbook-style, not a cited table).
- `operator_fatigue_score_at_start` is sampled directly (Beta(2,5), right-skewed toward well-rested) rather than simulated from a multi-day shift history — tasks.csv and telemetry_1min.parquet are independent, statistically-calibrated tables, not one causal simulation.
- `site_congestion_index_at_start` = (tasks at that site on that day) / (busiest site-day in the dataset), a same-day proxy rather than a rolling hourly window.
- `previous_task_overrun_ratio` / `task_sequence_number_in_shift` are computed per operator after sorting by (date, hour_of_day) — the lag features from CLAUDE.md section 5.2.
- `is_holiday` is an unconditioned ~3% Bernoulli flag, not tied to a real calendar.
<!-- section:Tasks (tasks.csv):end -->

## Demo-day schedule (schedule_today.csv)
<!-- section:Demo-day schedule (schedule_today.csv):start -->
- 2-3 tasks per operator on `config.demo_day`, built with the exact same `_build_row` model as tasks.csv (imported directly) so the demo schedule isn't a second, independently-drifting statistical model.
- `site_congestion_index_at_start` is fixed at 0.5 here (a single day has no cross-day baseline to compare against) and `previous_task_overrun_ratio` is left null — both are meaningful only in the full multi-day tasks.csv.
<!-- section:Demo-day schedule (schedule_today.csv):end -->

## Idle intent labels (idle_tags.csv, USP-3)
<!-- section:Idle intent labels (idle_tags.csv, USP-3):start -->
- Every contiguous idle run (gap <= 90s) becomes one window. Ground-truth `reason` is a heuristic, not a real operator response: the first idle window of a machine-day under 8 minutes is `warmup`; windows over 30 minutes or flagged as an injected `idle_spike` anomaly skew heavily toward `unjustified`; everything else skews toward `truck_wait` (the intended 'site bottleneck, not operator habit' case from CLAUDE.md section 6).
- `queue_position_estimate` is only meaningful (non-zero) when reason=truck_wait — a simple stand-in for 'how many trucks are ahead'.
<!-- section:Idle intent labels (idle_tags.csv, USP-3):end -->

## Cycle traces (cycle_traces.parquet)
<!-- section:Cycle traces (cycle_traces.parquet):start -->
- Per-phase duration bands (Expert ~3.5s, Intermediate ~5.0s, Beginner ~7.5s mean per phase) are an assumption inspired by the CAT Performance Handbook's cycle-time framing, not fit to a public per-second dataset — no such public dataset exists.
- Smoothness (jerk proxy) is `noise_deg` added on top of a smoothstep interpolation between phase-target joint angles; beginners also get a chance of an inserted pause frame per phase.
- USP-1 Ghost Operator: GhostPlayer.cs (Phase 7) replays an expert cycle trace next to a trainee; Scoring.cs compares cycle time/smoothness/fuel against it.
<!-- section:Cycle traces (cycle_traces.parquet):end -->

## Incidents & near-misses (incidents.csv)
<!-- section:Incidents & near-misses (incidents.csv):start -->
- Near-misses are derived directly from telemetry_1min.parquet, not sampled independently: red-zone-during-work (struck-by proxy), red-zone-during-reverse-travel (caught-between proxy), and belt-off-during-travel (rollover proxy, since seatbelt+ROPS per ISO 3471/6683 is specifically rollover protection).
- Contiguous flagged minutes per machine (gap <= 120s) are collapsed into one event, matching how a real detector would debounce a sustained breach rather than re-alerting every minute.
- ~1-in-`near_miss:near_miss_to_incident_ratio` events (default 250, capped at 40 incidents) are escalated to `is_near_miss=False` incidents with a Minor/Moderate/Severe severity — matching the 'near-miss:incident ratio high, incidents very rare' calibration target in CLAUDE.md section 5.
<!-- section:Incidents & near-misses (incidents.csv):end -->

## Hourly aggregate (telemetry_hourly.csv)
<!-- section:Hourly aggregate (telemetry_hourly.csv):start -->
- One row per (machine, hour-with-activity), aggregated from telemetry_1min.parquet: `idle_min`=idle minutes in that hour, `load_cycles`~=work-minutes/4 (documented proxy, not a true cycle detector), `fuel_used_l`=sum of that hour's per-minute fuel rate / 60, `safety_alert`='Yes' if idle_min>=45 or any belt-off-travel minute occurred in the hour, else 'No' — chosen because it reproduces the seed's own Yes/No pattern exactly.
- `engine_hours` is a per-machine running odometer: `hours_since_last_service/8` (an assumed prior baseline) + cumulative engine-on minutes/60 up to that hour.
- The 4 telemetry_seed.csv rows are force-patched in verbatim after aggregation (replacing whatever the simulation naturally produced for EXC001 at those exact timestamps) — CLAUDE.md section 1 explicitly asks to 'force the generator to reproduce them' rather than reverse-fit the minute-level simulation to those 4 points. This can leave a small, documented discontinuity in EXC001's surrounding engine_hours series.
<!-- section:Hourly aggregate (telemetry_hourly.csv):end -->
