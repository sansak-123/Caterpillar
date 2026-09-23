"""Generate telemetry_hourly.csv — CLAUDE.md section 5.1.

Aggregates telemetry_1min.parquet into the EXACT seed schema (9 columns), one row per
(machine, hour) that had any activity, then force-patches the 4 telemetry_seed.csv rows
in verbatim — CLAUDE.md's own instruction is to "force the generator to reproduce them"
rather than reverse-engineer the minute-level simulation to land on those exact values.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from common import GENERATED_DIR, SEED_DIR, append_calibration_note, ensure_dirs, load_config

SEED_COLUMNS = [
    "timestamp",
    "machine_id",
    "operator_id",
    "engine_hours",
    "fuel_used_l",
    "load_cycles",
    "idle_min",
    "seatbelt_status",
    "safety_alert",
]


def _aggregate_hour(g: pd.DataFrame) -> pd.Series:
    idle_min = int((g["state"] == "idle").sum())
    load_cycles = int(np.ceil((g["state"] == "work").sum() / 4))  # ~1 cycle per 4 work-minutes
    unfastened_travel = bool(((g["seatbelt"] == "Unfastened") & (g["state"] == "travel")).any())
    safety_alert = "Yes" if (idle_min >= 45 or unfastened_travel) else "No"
    seatbelt_status = "Unfastened" if (g["seatbelt"] == "Unfastened").mean() > 0.5 else "Fastened"
    return pd.Series(
        {
            "operator_id": g["operator_id"].iloc[0],
            "fuel_used_l": round(float(g["fuel_rate_lph"].sum() / 60), 1),
            "load_cycles": load_cycles,
            "idle_min": idle_min,
            "seatbelt_status": seatbelt_status,
            "safety_alert": safety_alert,
        }
    )


def generate(config: dict) -> pd.DataFrame:
    telemetry = pd.read_parquet(GENERATED_DIR / "telemetry_1min.parquet")
    telemetry["hour_ts"] = telemetry["ts"].dt.floor("h")

    hourly = (
        telemetry.groupby(["machine_id", "hour_ts"])
        .apply(_aggregate_hour, include_groups=False)
        .reset_index()
        .rename(columns={"hour_ts": "timestamp"})
    )

    # engine_hours: cumulative engine-on hours per machine, evaluated at the end of each hour
    telemetry_sorted = telemetry.sort_values(["machine_id", "ts"])
    telemetry_sorted["cum_minutes"] = telemetry_sorted.groupby("machine_id").cumcount() + 1
    engine_hours_at_hour = (
        telemetry_sorted.groupby(["machine_id", "hour_ts"])["cum_minutes"].max().div(60).round(1)
    )
    machines = pd.read_csv(GENERATED_DIR / "machines.csv").set_index("machine_id")
    base_engine_hours = machines["hours_since_last_service"].div(8).round(1)  # rough prior-hours offset

    hourly = hourly.merge(
        engine_hours_at_hour.rename("engine_hours_delta").reset_index().rename(columns={"hour_ts": "timestamp"}),
        on=["machine_id", "timestamp"],
    )
    hourly["engine_hours"] = hourly.apply(
        lambda r: round(base_engine_hours.get(r["machine_id"], 1500.0) + r["engine_hours_delta"], 1), axis=1
    )
    hourly = hourly.drop(columns=["engine_hours_delta"])
    hourly = hourly[SEED_COLUMNS].sort_values(["machine_id", "timestamp"]).reset_index(drop=True)

    # force-patch the seed rows in verbatim, exactly as CLAUDE.md section 1 gives them
    seed = pd.read_csv(SEED_DIR / "telemetry_seed.csv", parse_dates=["timestamp"])
    for _, seed_row in seed.iterrows():
        mask = (hourly["machine_id"] == seed_row["machine_id"]) & (hourly["timestamp"] == seed_row["timestamp"])
        if mask.any():
            hourly = hourly[~mask]
        hourly = pd.concat([hourly, pd.DataFrame([seed_row])], ignore_index=True)

    hourly = hourly.sort_values(["machine_id", "timestamp"]).reset_index(drop=True)
    return hourly


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    if not (GENERATED_DIR / "telemetry_1min.parquet").exists():
        raise SystemExit("Run telemetry.py first.")

    df = generate(config)
    out_path = GENERATED_DIR / "telemetry_hourly.csv"
    df.to_csv(out_path, index=False)
    print(f"[aggregate] wrote {len(df)} rows -> {out_path}")

    seed = pd.read_csv(SEED_DIR / "telemetry_seed.csv", parse_dates=["timestamp"])
    merged = df.merge(seed, on=list(seed.columns), how="inner")
    print(f"[aggregate] seed rows found verbatim: {len(merged)}/{len(seed)}")

    append_calibration_note(
        "Hourly aggregate (telemetry_hourly.csv)",
        [
            "- One row per (machine, hour-with-activity), aggregated from "
            "telemetry_1min.parquet: `idle_min`=idle minutes in that hour, "
            "`load_cycles`~=work-minutes/4 (documented proxy, not a true cycle "
            "detector), `fuel_used_l`=sum of that hour's per-minute fuel rate / 60, "
            "`safety_alert`='Yes' if idle_min>=45 or any belt-off-travel minute "
            "occurred in the hour, else 'No' — chosen because it reproduces the seed's "
            "own Yes/No pattern exactly.",
            "- `engine_hours` is a per-machine running odometer: "
            "`hours_since_last_service/8` (an assumed prior baseline) + cumulative "
            "engine-on minutes/60 up to that hour.",
            "- The 4 telemetry_seed.csv rows are force-patched in verbatim after "
            "aggregation (replacing whatever the simulation naturally produced for "
            "EXC001 at those exact timestamps) — CLAUDE.md section 1 explicitly asks to "
            "'force the generator to reproduce them' rather than reverse-fit the "
            "minute-level simulation to those 4 points. This can leave a small, "
            "documented discontinuity in EXC001's surrounding engine_hours series.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
