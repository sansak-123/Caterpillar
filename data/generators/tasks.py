"""Generate tasks.csv — CLAUDE.md section 5.1.

actual_min = est_min x skill_mult x weather_mult x age_mult x maintenance_mult x
soil_mult x fatigue_mult x lognormal noise, centred so the 5 seed rows (kept verbatim,
task_id T001-T005) read as typical rather than outliers.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from common import GENERATED_DIR, SEED_DIR, append_calibration_note, date_range, ensure_dirs, get_rng, load_config

TASK_TYPES = ["Earth Excavation", "Trenching", "Material Loading", "Grading", "Demolition"]
EST_PARAMS = {
    "Earth Excavation": (60, 15),
    "Trenching": (45, 12),
    "Material Loading": (30, 8),
    "Grading": (35, 10),
    "Demolition": (90, 20),
}
THROUGHPUT_M3_PER_MIN = {
    "Earth Excavation": 3.0,
    "Trenching": 1.5,
    "Material Loading": 4.0,
    "Grading": 5.0,
    "Demolition": 2.0,
}
MATERIAL_FOR_TASK = {
    "Earth Excavation": "soil",
    "Trenching": "soil",
    "Material Loading": "aggregate",
    "Grading": "soil",
    "Demolition": "debris_concrete",
}
MATERIAL_DENSITY_RANGE = {
    "soil": (1400, 1900),
    "aggregate": (1500, 2000),
    "debris_concrete": (1900, 2400),
}
SOIL_MULT = {"clay": 1.05, "laterite": 1.00, "sandy_loam": 0.97}
WEATHER_TO_CONDITION = {"Sunny": "Sunny", "Rainy": "Rainy", "Cloudy": "Cloudy", "Windy": "Windy"}

SEED_TASKS = pd.read_csv(SEED_DIR / "tasks_seed.csv")


def _sample_weather_numerics(rng: np.random.Generator, condition: str) -> dict:
    if condition == "Rainy":
        return {
            "precip_mm": round(float(rng.uniform(2, 15)), 1),
            "wind_kmh": round(float(rng.uniform(5, 20)), 1),
            "visibility_m": round(float(rng.uniform(1500, 6000)), 0),
            "temp_c": round(float(rng.uniform(22, 28)), 1),
            "humidity_pct": round(float(rng.uniform(75, 95)), 0),
        }
    if condition == "Windy":
        return {
            "precip_mm": 0.0,
            "wind_kmh": round(float(rng.uniform(26, 45)), 1),
            "visibility_m": round(float(rng.uniform(4000, 9000)), 0),
            "temp_c": round(float(rng.uniform(24, 36)), 1),
            "humidity_pct": round(float(rng.uniform(30, 60)), 0),
        }
    if condition == "Cloudy":
        return {
            "precip_mm": 0.0,
            "wind_kmh": round(float(rng.uniform(5, 18)), 1),
            "visibility_m": round(float(rng.uniform(4000, 9000)), 0),
            "temp_c": round(float(rng.uniform(24, 32)), 1),
            "humidity_pct": round(float(rng.uniform(70, 85)), 0),
        }
    return {
        "precip_mm": 0.0,
        "wind_kmh": round(float(rng.uniform(3, 15)), 1),
        "visibility_m": round(float(rng.uniform(7000, 10000)), 0),
        "temp_c": round(float(rng.uniform(28, 40)), 1),
        "humidity_pct": round(float(rng.uniform(30, 65)), 0),
    }


def _build_row(
    rng: np.random.Generator,
    config: dict,
    task_id: str,
    machines: pd.DataFrame,
    operators: pd.DataFrame,
    sites: pd.DataFrame,
    days: list[dt.date],
    forced: dict | None,
    forced_operator_id: str | None = None,
) -> dict:
    task_type = forced["task_type"] if forced else rng.choice(TASK_TYPES)
    if forced_operator_id is not None:
        operator = operators[operators["operator_id"] == forced_operator_id].iloc[0]
    else:
        operator = operators.sample(random_state=rng.integers(0, 2**31)).iloc[0]
        if forced:
            candidates = operators[operators["skill"] == forced["operator_skill"]]
            operator = (candidates if len(candidates) else operators).sample(
                random_state=rng.integers(0, 2**31)
            ).iloc[0]

    machine = machines.sample(random_state=rng.integers(0, 2**31)).iloc[0]
    if forced:
        candidates = machines[machines["age_yrs"] == forced["machine_age_yrs"]]
        machine = (candidates if len(candidates) else machines).sample(
            random_state=rng.integers(0, 2**31)
        ).iloc[0]

    site = sites.sample(random_state=rng.integers(0, 2**31)).iloc[0]
    day = days[int(rng.integers(0, len(days)))]
    hour = int(rng.integers(7, 17))
    condition = forced["weather"] if forced else str(rng.choice(list(WEATHER_TO_CONDITION)))
    weather_num = _sample_weather_numerics(rng, condition)

    est_mean, est_std = EST_PARAMS[task_type]
    est_min = forced["est_min"] if forced else int(np.clip(rng.normal(est_mean, est_std), 10, 240))

    material_type = MATERIAL_FOR_TASK[task_type]
    density_lo, density_hi = MATERIAL_DENSITY_RANGE[material_type]
    material_density = round(float(rng.uniform(density_lo, density_hi)), 0)
    planned_volume_m3 = round(est_min * THROUGHPUT_M3_PER_MIN[task_type] * rng.uniform(0.85, 1.15), 1)

    # Maintenance debt and fatigue are centred on their population mean so a
    # well-maintained machine / rested operator pulls the estimate down, not just
    # "no penalty" — otherwise every task picks up a one-directional inflation on top
    # of skill_mult/weather_mult, which drags the average well past the seed anchors.
    hours_since_service = float(machine["hours_since_last_service"])
    maintenance_ratio = min(hours_since_service / float(machine["service_interval_hrs"]), 1.1)
    maintenance_swing = config["overrun_multiplier"]["maintenance_debt_max_multiplier"] - 1.0
    maintenance_mult = 1.0 + (maintenance_ratio - 0.55) / 0.55 * maintenance_swing

    fatigue_score = float(np.clip(rng.beta(2, 5), 0, 1))
    rest_hours = float(np.clip(9 - fatigue_score * 5 + rng.normal(0, 0.5), 3, 10))
    fatigue_swing = config["overrun_multiplier"]["fatigue_max_multiplier"] - 1.0
    fatigue_mult = 1.0 + (fatigue_score - 2 / 7) / (1 - 2 / 7) * fatigue_swing

    skill = forced["operator_skill"] if forced else operator["skill"]
    skill_key = skill.lower() if skill.lower() in config["overrun_multiplier"]["skill"] else "intermediate"
    skill_mult = config["overrun_multiplier"]["skill"][skill_key]
    weather_mult = config["overrun_multiplier"]["weather"][condition.lower()]
    age_yrs = forced["machine_age_yrs"] if forced else int(machine["age_yrs"])
    age_rate = float(rng.uniform(*config["overrun_multiplier"]["machine_age_pct_per_year_above_3yrs"]))
    age_mult = 1.0 + max(age_yrs - 3, 0) * age_rate
    soil_mult = SOIL_MULT[site["soil_type"]]

    if forced:
        actual_min = forced["actual_min"]
    else:
        noise = float(rng.lognormal(mean=0, sigma=0.07))
        actual_min = max(
            5,
            round(
                est_min
                * skill_mult
                * weather_mult
                * age_mult
                * maintenance_mult
                * soil_mult
                * fatigue_mult
                * noise
            ),
        )

    return {
        "task_id": task_id,
        "task_type": task_type,
        "weather": condition,
        "operator_skill": skill,
        "machine_age_yrs": age_yrs,
        "est_min": est_min,
        "actual_min": actual_min,
        "site_id": site["site_id"],
        "precip_mm": weather_num["precip_mm"],
        "wind_kmh": weather_num["wind_kmh"],
        "visibility_m": weather_num["visibility_m"],
        "temp_c": weather_num["temp_c"],
        "humidity_pct": weather_num["humidity_pct"],
        "soil_type": site["soil_type"],
        "hour_of_day": hour,
        "day_of_week": day.weekday(),
        "is_holiday": bool(rng.random() < 0.03),
        "planned_volume_m3": planned_volume_m3,
        "material_type": material_type,
        "material_density_kg_m3": material_density,
        "dig_depth_m": round(float(rng.uniform(0.5, 4.5)), 2),
        "haul_distance_m": round(float(rng.uniform(20, 800)), 0),
        "truck_wait_min": round(float(np.clip(rng.exponential(4), 0, 60)), 1),
        "number_of_trucks": int(rng.integers(0, 5)),
        "operator_id": operator["operator_id"],
        "machine_id": machine["machine_id"],
        "hours_since_last_service": hours_since_service,
        "operator_fatigue_score_at_start": round(fatigue_score, 3),
        "rest_hours_before_shift": round(rest_hours, 1),
        "site_congestion_index_at_start": None,  # filled after all rows exist
        "number_of_nearby_workers": int(rng.poisson(2.5)),
        "ppe_compliance_flag": bool(rng.random() < 0.93),
        "pre_start_checklist_completed": bool(rng.random() < 0.90),
        "_date": day.isoformat(),
        "task_sequence_number_in_shift": None,  # filled after sort
        "previous_task_overrun_ratio": None,  # filled after sort
    }


def generate(config: dict) -> pd.DataFrame:
    rng = get_rng(config, "tasks")
    machines = pd.read_csv(GENERATED_DIR / "machines.csv")
    operators = pd.read_csv(GENERATED_DIR / "operators.csv")
    sites = pd.read_csv(GENERATED_DIR / "sites.csv")
    days = date_range(config)

    rows = []
    for _, seed_row in SEED_TASKS.iterrows():
        rows.append(
            _build_row(
                rng,
                config,
                seed_row["task_id"],
                machines,
                operators,
                sites,
                days,
                forced=seed_row.to_dict(),
            )
        )

    n_remaining = config["tasks"]["count"] - len(rows)
    for i in range(n_remaining):
        task_id = f"T{1000 + i:04d}"
        rows.append(_build_row(rng, config, task_id, machines, operators, sites, days, forced=None))

    df = pd.DataFrame(rows)

    # engineered features that need the full table: site congestion + per-operator lag/sequence
    df["_date"] = pd.to_datetime(df["_date"])
    congestion = df.groupby(["site_id", "_date"])["task_id"].transform("count")
    df["site_congestion_index_at_start"] = (congestion / congestion.max()).round(3)

    df = df.sort_values(["operator_id", "_date", "hour_of_day"]).reset_index(drop=True)
    grp = df.groupby("operator_id")
    df["task_sequence_number_in_shift"] = grp.cumcount() + 1
    overrun_ratio = df["actual_min"] / df["est_min"]
    df["previous_task_overrun_ratio"] = grp.apply(
        lambda g: overrun_ratio.loc[g.index].shift(1), include_groups=False
    ).reset_index(level=0, drop=True)
    df["previous_task_overrun_ratio"] = df["previous_task_overrun_ratio"].round(3)

    df = df.rename(columns={"_date": "task_date"}).sort_values("task_id").reset_index(drop=True)
    df["task_date"] = df["task_date"].dt.date.astype(str)
    return df


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    for needed in ("machines.csv", "operators.csv", "sites.csv"):
        if not (GENERATED_DIR / needed).exists():
            raise SystemExit(f"Run the generator for {needed} first.")

    df = generate(config)
    out_path = GENERATED_DIR / "tasks.csv"
    df.to_csv(out_path, index=False)
    print(f"[tasks] wrote {len(df)} rows -> {out_path}")

    append_calibration_note(
        "Tasks (tasks.csv)",
        [
            "- `actual_min = est_min x skill_mult x weather_mult x age_mult x "
            "maintenance_mult x soil_mult x fatigue_mult x lognormal(0, 0.07)`, "
            "multipliers from `data/config.yaml.overrun_multiplier` (values centred on "
            "the seed's per-skill/weather ratios in CLAUDE.md section 1).",
            "- The 5 seed rows keep their exact task_id/task_type/weather/operator_skill/"
            "machine_age_yrs/est_min/actual_min; only the expanded columns around them "
            "are synthesized (a matching operator/machine/site is sampled, numeric "
            "weather fields are drawn conditioned on the seed's categorical weather).",
            "- `planned_volume_m3` is back-derived from est_min via a fixed per-task-type "
            "throughput rate (loosely CAT Performance Handbook-style, not a cited table).",
            "- `operator_fatigue_score_at_start` is sampled directly (Beta(2,5), "
            "right-skewed toward well-rested) rather than simulated from a multi-day "
            "shift history — tasks.csv and telemetry_1min.parquet are independent, "
            "statistically-calibrated tables, not one causal simulation.",
            "- `site_congestion_index_at_start` = (tasks at that site on that day) / "
            "(busiest site-day in the dataset), a same-day proxy rather than a rolling "
            "hourly window.",
            "- `previous_task_overrun_ratio` / `task_sequence_number_in_shift` are "
            "computed per operator after sorting by (date, hour_of_day) — the lag "
            "features from CLAUDE.md section 5.2.",
            "- `is_holiday` is an unconditioned ~3% Bernoulli flag, not tied to a real "
            "calendar.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
