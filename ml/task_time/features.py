"""Feature engineering for the task-time overrun-ratio model — CLAUDE.md section 6.

Builds on tasks.csv but adds the two engineered features that need a cross-reference
into telemetry_1min.parquet (operator's rolling 7-day idle ratio) and operators.csv
(ghost_skill_factor as the "measured_skill_score" from training/USP-1) — these are
listed in CLAUDE.md section 5.2 but only make sense to compute at feature-build time,
not baked into tasks.csv itself.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA_GENERATED = Path(__file__).resolve().parents[2] / "data" / "generated"

CATEGORICAL_COLUMNS = ["task_type", "operator_skill", "weather", "soil_type", "material_type"]
BOOLEAN_COLUMNS = ["is_holiday", "ppe_compliance_flag", "pre_start_checklist_completed"]
NUMERIC_COLUMNS = [
    "machine_age_yrs",
    "hours_since_last_service",
    "precip_mm",
    "wind_kmh",
    "visibility_m",
    "temp_c",
    "humidity_pct",
    "dig_depth_m",
    "haul_distance_m",
    "hour_of_day",
    "day_of_week",
    "planned_volume_m3",
    "truck_wait_min",
    "number_of_trucks",
    "task_sequence_number_in_shift",
    "number_of_nearby_workers",
    "site_congestion_index_at_start",
    "operator_fatigue_score_at_start",
    "previous_task_overrun_ratio",
]
ENGINEERED_COLUMNS = ["measured_skill_score", "operator_idle_ratio_7d"]

FEATURE_COLUMNS = CATEGORICAL_COLUMNS + BOOLEAN_COLUMNS + NUMERIC_COLUMNS + ENGINEERED_COLUMNS


def _operator_daily_idle_ratio() -> pd.DataFrame:
    telemetry = pd.read_parquet(
        DATA_GENERATED / "telemetry_1min.parquet", columns=["ts", "operator_id", "state"]
    )
    telemetry["date"] = telemetry["ts"].dt.date
    daily = telemetry.groupby(["operator_id", "date"]).agg(
        idle_minutes=("state", lambda s: (s == "idle").sum()), total_minutes=("state", "size")
    )
    daily["idle_ratio"] = daily["idle_minutes"] / daily["total_minutes"]
    return daily.reset_index()


def _rolling_7d_idle_ratio(tasks: pd.DataFrame, daily_idle: pd.DataFrame) -> pd.Series:
    daily_idle = daily_idle.sort_values(["operator_id", "date"])
    daily_idle["rolling_7d"] = daily_idle.groupby("operator_id")["idle_ratio"].transform(
        lambda s: s.rolling(7, min_periods=1).mean()
    )
    lookup = daily_idle.set_index(["operator_id", "date"])["rolling_7d"]

    keys = list(zip(tasks["operator_id"], tasks["task_date"], strict=True))
    return pd.Series([lookup.get(k, np.nan) for k in keys], index=tasks.index)


def build_feature_frame() -> pd.DataFrame:
    tasks = pd.read_csv(DATA_GENERATED / "tasks.csv", parse_dates=["task_date"])
    tasks["task_date"] = tasks["task_date"].dt.date
    operators = pd.read_csv(DATA_GENERATED / "operators.csv").set_index("operator_id")

    tasks["measured_skill_score"] = tasks["operator_id"].map(operators["ghost_skill_factor"])

    daily_idle = _operator_daily_idle_ratio()
    tasks["operator_idle_ratio_7d"] = _rolling_7d_idle_ratio(tasks, daily_idle)
    # backfill with the fleet mean for tasks whose operator has no telemetry history yet
    tasks["operator_idle_ratio_7d"] = tasks["operator_idle_ratio_7d"].fillna(
        tasks["operator_idle_ratio_7d"].mean()
    )
    tasks["previous_task_overrun_ratio"] = tasks["previous_task_overrun_ratio"].fillna(
        tasks["previous_task_overrun_ratio"].mean()
    )

    for col in BOOLEAN_COLUMNS:
        tasks[col] = tasks[col].astype(int)

    tasks["overrun_ratio"] = tasks["actual_min"] / tasks["est_min"]
    return tasks


def encode_categoricals(df: pd.DataFrame, categories: dict[str, list[str]] | None = None) -> tuple[pd.DataFrame, dict]:
    """Ordinal-encodes the categorical columns to plain integers up front (rather than
    relying on LightGBM/ONNX native categorical support, which is finicky across the
    onnxmltools conversion) — the mapping is written to feature_schema.json so the
    mobile runtime can reproduce it exactly."""
    encoded = df.copy()
    mapping: dict[str, list[str]] = {}
    for col in CATEGORICAL_COLUMNS:
        cats = categories[col] if categories else sorted(df[col].dropna().unique().tolist())
        mapping[col] = cats
        code_map = {c: i for i, c in enumerate(cats)}
        encoded[col] = df[col].map(code_map).fillna(-1).astype(int)
    return encoded, mapping


def feature_schema(categories: dict[str, list[str]]) -> dict:
    return {
        "features": FEATURE_COLUMNS,
        "categorical_encodings": categories,
        "boolean_columns": BOOLEAN_COLUMNS,
        "nullable_with_fleet_mean_fallback": ["operator_idle_ratio_7d", "previous_task_overrun_ratio"],
        "target": "overrun_ratio",
        "baseline": "est_min (implicitly assumes overrun_ratio = 1.0)",
    }


def save_feature_schema(categories: dict[str, list[str]], path: Path) -> None:
    path.write_text(json.dumps(feature_schema(categories), indent=2), encoding="utf-8")
