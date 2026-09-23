"""Generate telemetry_1min.parquet — CLAUDE.md section 5.1.

A per-(machine, day) state-machine simulation (warmup -> work/idle/travel -> shift end).
Off-shift minutes are not emitted (sparse logging convention, documented in
calibration.md) — engine_on is always True for the rows that exist.

EXC001 is forced to be operated by OP1001 on the two seed dates so telemetry_1min tells
the same story as telemetry_seed.csv even though the hourly aggregate (aggregate.py) is
what actually gets patched to match the seed verbatim.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from common import (
    GENERATED_DIR,
    LABELS_DIR,
    append_calibration_note,
    date_range,
    ensure_dirs,
    get_rng,
    load_config,
)

SEED_DATES = {dt.date(2025, 5, 1), dt.date(2025, 5, 2)}
SEED_MACHINE = "EXC001"
SEED_OPERATOR = "OP1001"

PERSONA_IDLE_RATIO = {
    "disciplined": 0.15,
    "idler": 0.65,
    "belt_skipper": 0.35,
    "rusher": 0.12,
    "learner": None,  # computed per-day, see _idle_ratio_for
}
PERSONA_SPIKE_PROB = {
    "disciplined": 0.05,
    "idler": 0.50,
    "belt_skipper": 0.35,
    "rusher": 0.05,
    "learner": 0.20,
}
PERSONA_UNFASTENED_P = {
    # (idle, travel) unfastened probabilities per persona
    "disciplined": (0.03, 0.03),
    "idler": (0.15, 0.20),
    "belt_skipper": (0.55, 0.50),
    "rusher": (0.10, 0.25),
    "learner": (0.10, 0.10),
}
PERSONA_BREACH_RATE = {  # near-miss proximity breach chance per work-minute
    "disciplined": 0.003,
    "idler": 0.003,
    "belt_skipper": 0.006,
    "rusher": 0.022,
    "learner": 0.008,
}


def _idle_ratio_for(persona: str, day_index: int, n_days: int) -> float:
    if persona == "learner":
        return 0.45 - 0.25 * (day_index / max(n_days - 1, 1))
    return PERSONA_IDLE_RATIO[persona]


def _machine_site_map(machines: pd.DataFrame, sites: pd.DataFrame) -> dict[str, str]:
    site_ids = sites["site_id"].tolist()
    return {row.machine_id: site_ids[i % len(site_ids)] for i, row in enumerate(machines.itertuples())}


def _daily_assignment(
    machines: pd.DataFrame, operators: pd.DataFrame, days: list[dt.date], rng: np.random.Generator
) -> pd.DataFrame:
    """One operator per (machine, day). EXC001/OP1001 is forced on the seed dates."""
    op_ids = operators["operator_id"].to_numpy()
    rows = []
    for day in days:
        chosen = rng.choice(op_ids, size=len(machines), replace=True)
        for machine_id, operator_id in zip(machines["machine_id"], chosen, strict=True):
            if day in SEED_DATES and machine_id == SEED_MACHINE:
                operator_id = SEED_OPERATOR
            rows.append({"date": day, "machine_id": machine_id, "operator_id": operator_id})
    return pd.DataFrame(rows)


def _segments(
    rng: np.random.Generator, shift_len: int, idle_ratio: float
) -> list[tuple[str, int]]:
    """Alternating work/idle(/travel) segments filling `shift_len` minutes."""
    segments: list[tuple[str, int]] = [("idle", 5)]  # warmup
    remaining = shift_len - 5
    while remaining > 0:
        work_len = int(np.clip(rng.normal(16, 6), 5, 40))
        work_len = min(work_len, remaining)
        segments.append(("work", work_len))
        remaining -= work_len
        if remaining <= 0:
            break

        if rng.random() < 0.20:
            rest_len = int(np.clip(rng.normal(6, 2), 3, 12))
            rest_state = "travel"
        else:
            ratio = max(idle_ratio, 0.02)
            rest_len = int(np.clip(work_len * (ratio / (1 - ratio)) * rng.lognormal(0, 0.4), 2, 90))
            rest_state = "idle"
        rest_len = min(rest_len, remaining)
        segments.append((rest_state, rest_len))
        remaining -= rest_len
    return segments


def _inject_idle_spike(
    segments: list[tuple[str, int]], rng: np.random.Generator
) -> tuple[list[tuple[str, int]], bool]:
    idle_positions = [i for i, (s, _) in enumerate(segments) if s == "idle"]
    if not idle_positions:
        return segments, False
    i = rng.choice(idle_positions)
    spike_len = int(rng.uniform(45, 90))
    segments[i] = ("idle", spike_len)
    return segments, True


def _simulate_machine_day(
    machine: pd.Series,
    operator: pd.Series,
    site_id: str,
    day: dt.date,
    day_index: int,
    n_days: int,
    weather_by_hour: dict[int, pd.Series],
    site_row: pd.Series,
    rng: np.random.Generator,
    labels: list[dict],
) -> pd.DataFrame:
    persona = operator["persona"]
    idle_ratio = _idle_ratio_for(persona, day_index, n_days)
    is_night = operator["shift"] == "night"
    shift_start_hour = 20 if is_night else 8
    shift_start_min = int((shift_start_hour + rng.normal(0, 0.25)) * 60)
    shift_len = int(np.clip(rng.uniform(7, 9) * 60, 300, 600))

    segments = _segments(rng, shift_len, idle_ratio)
    spiked = False
    if rng.random() < PERSONA_SPIKE_PROB[persona]:
        segments, spiked = _inject_idle_spike(segments, rng)

    n = sum(length for _, length in segments)
    state = np.empty(n, dtype=object)
    minute_offsets = np.arange(n)
    pos = 0
    for seg_state, length in segments:
        state[pos : pos + length] = seg_state
        pos += length

    minute_of_day = (shift_start_min + minute_offsets) % 1440
    hour_of_day = minute_of_day // 60
    ts = pd.to_datetime(day) + pd.to_timedelta(shift_start_min + minute_offsets, unit="m")

    is_work = state == "work"
    is_idle = state == "idle"
    is_travel = state == "travel"

    unfastened_p_idle, unfastened_p_travel = PERSONA_UNFASTENED_P[persona]
    seatbelt = np.full(n, "Fastened", dtype=object)
    # decide per contiguous segment, not per minute, so a segment reads as one event
    pos = 0
    belt_off_spans: list[tuple[int, int]] = []
    for seg_state, length in segments:
        if seg_state == "idle" and rng.random() < unfastened_p_idle:
            seatbelt[pos : pos + length] = "Unfastened"
        elif seg_state == "travel" and rng.random() < unfastened_p_travel:
            seatbelt[pos : pos + length] = "Unfastened"
            belt_off_spans.append((pos, pos + length))
        pos += length

    engine_rpm = np.select(
        [is_work, is_travel, is_idle],
        [rng.normal(1800, 120, n), rng.normal(1400, 100, n), rng.normal(750, 40, n)],
    )
    fuel_rate_lph = np.select(
        [is_work, is_travel, is_idle],
        [
            rng.normal(machine["work_lph"], machine["work_lph"] * 0.08, n),
            rng.normal((machine["work_lph"] + machine["idle_lph"]) / 2, 0.4, n),
            rng.normal(machine["idle_lph"], machine["idle_lph"] * 0.1, n),
        ],
    ).clip(min=0.1)

    swing_rate_dps = np.where(is_work, np.clip(rng.normal(35, 12, n), 0, None), rng.uniform(0, 2, n))
    if persona == "rusher":
        swing_rate_dps = np.where(is_work, swing_rate_dps * 1.4, swing_rate_dps)
    travel_kmh = np.where(is_travel, np.clip(rng.normal(8, 2, n), 0.5, None), 0.0)
    reverse = is_travel & (rng.random(n) < 0.25)

    hydraulic_pressure_bar = np.select(
        [is_work, is_travel, is_idle],
        [rng.normal(210, 30, n), rng.normal(35, 10, n), rng.normal(15, 5, n)],
    ).clip(min=0)

    engine_on_minutes = np.arange(1, n + 1)
    equilibrium_hyd = 90.0
    equilibrium_coolant = 92.0
    ambient = weather_by_hour[hour_of_day[0]].temp_c if n else 28.0
    warmup_curve = 1 - np.exp(-engine_on_minutes / 25.0)
    hydraulic_oil_temp_c = ambient + 8 + (equilibrium_hyd - (ambient + 8)) * warmup_curve
    hydraulic_oil_temp_c += rng.normal(0, 1.5, n)
    coolant_temp_c = ambient + 10 + (equilibrium_coolant - (ambient + 10)) * warmup_curve
    coolant_temp_c += rng.normal(0, 1.2, n)

    battery_voltage_v = rng.normal(27.5, 0.3, n)
    def_level_pct = np.clip(100 - ((day_index % 20) / 20 * 100) - minute_offsets * 0.002, 5, 100)

    material_density = rng.uniform(1600, 2200)
    fill_factor = rng.uniform(0.6, 1.0, n)
    is_dig_moment = is_work & (rng.random(n) < 0.4)
    payload_kg = np.where(is_dig_moment, machine["bucket_capacity_m3"] * material_density * fill_factor, 0.0)

    machine_weight_kg = machine["model_size_t"] * 1000
    ground_pressure_kpa = (machine_weight_kg + payload_kg) * 9.81 / 1000 / 2.2 + rng.normal(0, 3, n)

    lat_walk = np.cumsum(rng.normal(0, np.where(is_travel, 0.00006, 0.00001), n))
    lon_walk = np.cumsum(rng.normal(0, np.where(is_travel, 0.00006, 0.00001), n))
    gps_lat = site_row["lat"] + lat_walk
    gps_lon = site_row["lon"] + lon_walk
    gps_heading = rng.uniform(0, 360, n)
    altitude_m = site_row["elevation_m"] + rng.normal(0, 1.5, n)
    slope_pct = np.clip(rng.normal(4 if site_row["terrain_type"] == "rolling_hills" else 1.5, 1.0, n), 0, None)

    vibration_rms = np.select(
        [is_work, is_travel, is_idle],
        [rng.normal(3.5, 0.8, n), rng.normal(1.8, 0.5, n), rng.normal(0.6, 0.2, n)],
    ).clip(min=0)
    cabin_noise_db = 60 + (engine_rpm - 700) / 1300 * 30 + rng.normal(0, 2, n)

    fault_p = np.clip(machine["fault_code_history_count"] * 0.00003, 0, 0.01)
    fault_code_active = rng.random(n) < fault_p

    # worker-proximity toy model: usually far away, occasional close excursions during work
    breach_rate = PERSONA_BREACH_RATE[persona]
    breach = is_work & (rng.random(n) < breach_rate)
    nearest_person_m = np.where(breach, rng.uniform(3, 18, n), rng.uniform(25, 120, n))
    weather_row = weather_by_hour[hour_of_day[0]] if n else None

    def _zone_for(distance: np.ndarray, cond_factor: float) -> np.ndarray:
        red = 9 * cond_factor
        amber = 20 * cond_factor
        return np.where(distance < red, "red", np.where(distance < amber, "amber", "green"))

    cond_factor = 1.0
    if weather_row is not None:
        cond_factor *= 1.0 + max(0.0, (1000 - weather_row.visibility_m) / 2000)
        cond_factor *= 1.0 + weather_row.wind_kmh / 100
    zone = _zone_for(nearest_person_m, cond_factor)
    nearby_machines_count = rng.poisson(0.6, n)
    gps_accuracy_m = np.where(machine["gps_enabled"], rng.uniform(1, 4, n), rng.uniform(8, 25, n))

    df = pd.DataFrame(
        {
            "ts": ts,
            "machine_id": machine["machine_id"],
            "operator_id": operator["operator_id"],
            "site_id": site_id,
            "engine_on": True,
            "state": state,
            "engine_rpm": engine_rpm.round(0),
            "fuel_rate_lph": fuel_rate_lph.round(2),
            "seatbelt": seatbelt,
            "swing_rate_dps": swing_rate_dps.round(1),
            "travel_kmh": travel_kmh.round(2),
            "reverse": reverse,
            "hydraulic_pressure_bar": hydraulic_pressure_bar.round(1),
            "hydraulic_oil_temp_c": hydraulic_oil_temp_c.round(1),
            "coolant_temp_c": coolant_temp_c.round(1),
            "battery_voltage_v": battery_voltage_v.round(2),
            "def_level_pct": def_level_pct.round(1),
            "payload_kg": payload_kg.round(0),
            "ground_pressure_kpa": ground_pressure_kpa.round(1),
            "gps_lat": gps_lat.round(6),
            "gps_lon": gps_lon.round(6),
            "gps_heading": gps_heading.round(1),
            "altitude_m": altitude_m.round(1),
            "slope_pct": slope_pct.round(1),
            "vibration_rms": vibration_rms.round(2),
            "cabin_noise_db": cabin_noise_db.round(1),
            "fault_code_active": fault_code_active,
            "nearest_person_m": nearest_person_m.round(1),
            "zone": zone,
            "nearby_machines_count": nearby_machines_count,
            "gps_accuracy_m": gps_accuracy_m.round(1),
        }
    )

    if spiked:
        labels.append(
            {
                "machine_id": machine["machine_id"],
                "operator_id": operator["operator_id"],
                "date": day.isoformat(),
                "anomaly_type": "idle_spike",
            }
        )
    for start, end in belt_off_spans:
        labels.append(
            {
                "machine_id": machine["machine_id"],
                "operator_id": operator["operator_id"],
                "date": day.isoformat(),
                "anomaly_type": "belt_off_travel",
                "ts_start": str(df["ts"].iloc[start]),
                "ts_end": str(df["ts"].iloc[min(end, n - 1)]),
            }
        )
    if persona == "rusher":
        labels.append(
            {
                "machine_id": machine["machine_id"],
                "operator_id": operator["operator_id"],
                "date": day.isoformat(),
                "anomaly_type": "rushing",
            }
        )

    return df


def generate(config: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    machines = pd.read_csv(GENERATED_DIR / "machines.csv")
    operators = pd.read_csv(GENERATED_DIR / "operators.csv")
    sites = pd.read_csv(GENERATED_DIR / "sites.csv").set_index("site_id")
    weather = pd.read_csv(GENERATED_DIR / "weather_hourly.csv", parse_dates=["ts"])
    weather["hour"] = weather["ts"].dt.hour
    weather["date"] = weather["ts"].dt.date

    days = date_range(config)
    n_days = len(days)
    machine_site = _machine_site_map(machines, sites.reset_index())
    rng_assign = get_rng(config, "telemetry:assignment")
    assignment = _daily_assignment(machines, operators, days, rng_assign)

    machines_idx = machines.set_index("machine_id")
    operators_idx = operators.set_index("operator_id")

    weather_lookup = {
        (row.site_id, row.date, row.hour): row for row in weather.itertuples(index=False)
    }

    frames = []
    labels: list[dict] = []
    rng = get_rng(config, "telemetry:sim")

    for day_index, day in enumerate(days):
        day_assign = assignment[assignment["date"] == day]
        for _, a in day_assign.iterrows():
            machine = machines_idx.loc[a["machine_id"]].copy()
            machine["machine_id"] = a["machine_id"]
            operator = operators_idx.loc[a["operator_id"]].copy()
            operator["operator_id"] = a["operator_id"]
            site_id = machine_site[a["machine_id"]]
            site_row = sites.loc[site_id]

            weather_by_hour = {
                h: weather_lookup.get((site_id, day, h), weather_lookup.get((site_id, day, 12)))
                for h in range(24)
            }

            df = _simulate_machine_day(
                machine, operator, site_id, day, day_index, n_days, weather_by_hour, site_row, rng, labels
            )
            frames.append(df)

    telemetry = pd.concat(frames, ignore_index=True)
    labels_df = pd.DataFrame(labels)
    return telemetry, labels_df


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    for needed in ("machines.csv", "operators.csv", "sites.csv", "weather_hourly.csv"):
        if not (GENERATED_DIR / needed).exists():
            raise SystemExit(f"Run the generator for {needed} first.")

    telemetry, labels_df = generate(config)
    out_path = GENERATED_DIR / "telemetry_1min.parquet"
    telemetry.to_parquet(out_path, index=False)
    labels_path = LABELS_DIR / "telemetry_anomalies.csv"
    labels_df.to_csv(labels_path, index=False)
    print(f"[telemetry] wrote {len(telemetry)} rows -> {out_path}")
    print(f"[telemetry] wrote {len(labels_df)} anomaly labels -> {labels_path}")

    append_calibration_note(
        "Telemetry (telemetry_1min.parquet)",
        [
            "- Off-shift minutes are not emitted at all (sparse-logging convention) — "
            "every row has engine_on=True. `off` remains a valid value of `state` for "
            "downstream code, it just never appears in this generated table.",
            "- Idle ratio targets per persona come from CLAUDE.md section 5 "
            "(disciplined ~15%, idler ~65%, belt_skipper ~35%, rusher ~12%); `learner` "
            "decreases linearly from ~45% to ~20% across the 90-day run to represent "
            "improving skill (USP-1 Ghost Operator).",
            "- Seatbelt status is decided once per contiguous segment (not per minute) so "
            "it reads as one coherent event rather than per-minute flicker.",
            "- `hydraulic_oil_temp_c`/`coolant_temp_c` follow a simple warm-up curve "
            "(1 - e^(-t/25min)) toward a fixed equilibrium from the hour's ambient "
            "temperature — a first-order approximation, not a thermal model.",
            "- `def_level_pct` is a deterministic 20-day sawtooth (refill every 20 days) "
            "rather than usage-linked depletion — documented simplification.",
            "- Proximity `zone` uses a simplified condition factor (visibility + wind only) "
            "on top of fixed 9m/20m red/amber base radii; the full condition-adaptive "
            "formula (machine class, swing/reverse state factor) is the device-side safety "
            "engine's job in Phase 5, this table only needs plausible history + labels.",
            "- EXC001 is forced to be operated by OP1001 on 2025-05-01 and 2025-05-02 so "
            "this table's narrative matches telemetry_seed.csv even though the seed rows "
            "themselves are injected verbatim only into telemetry_hourly.csv "
            "(aggregate.py) — reconciling exact seed values against a live minute-level "
            "simulation isn't attempted, per the Phase 1 brief's 'force the generator to "
            "reproduce them' instruction.",
            "- Injected, labelled anomalies (`data/generated/labels/telemetry_anomalies.csv`): "
            "`idle_spike` (one oversized idle segment per triggered machine-day), "
            "`belt_off_travel` (seatbelt unfastened during a travel segment), and "
            "`rushing` (flagged for the whole machine-day when persona=rusher) — for "
            "ml/anomaly precision/recall evaluation in Phase 3.",
        ],
    )
    return telemetry


if __name__ == "__main__":
    main()
