"""Generate machines.csv — CLAUDE.md section 5.1.

EXC001 is fixed (referenced verbatim by telemetry_seed.csv); the rest of the fleet is
sampled to match the configured class mix and give a realistic spread of ages/specs.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from common import GENERATED_DIR, append_calibration_note, ensure_dirs, get_rng, load_config

CLASS_SPECS = {
    "excavator": {"size_t": (18, 45), "power_kw": (90, 220), "bucket_m3": (0.8, 2.5)},
    "wheel_loader": {"size_t": (10, 30), "power_kw": (80, 180), "bucket_m3": (1.5, 4.0)},
    "dozer": {"size_t": (15, 40), "power_kw": (100, 250), "bucket_m3": (0.0, 0.0)},
}

BLIND_SPOT_PROFILE = {
    "excavator": "rear_swing_blind",
    "wheel_loader": "front_bucket_blind",
    "dozer": "rear_wide_blind",
}

FLEET_PLAN = (
    ["excavator"] * 6 + ["wheel_loader"] * 4 + ["dozer"] * 2
)  # 12 machines total, matches fleet.num_machines in config.yaml


def _machine_ids() -> list[str]:
    counters = {"excavator": 0, "wheel_loader": 0, "dozer": 0}
    prefix = {"excavator": "EXC", "wheel_loader": "WLD", "dozer": "DZR"}
    ids = []
    for cls in FLEET_PLAN:
        counters[cls] += 1
        ids.append(f"{prefix[cls]}{counters[cls]:03d}")
    return ids


def generate(config: dict) -> pd.DataFrame:
    rng = get_rng(config, "machines")
    ids = _machine_ids()
    n = len(ids)
    assert n == config["fleet"]["num_machines"], "FLEET_PLAN must match fleet.num_machines"

    rows = []
    today = dt.date.fromisoformat(config["start_date"]) + dt.timedelta(days=config["days"])

    for machine_id, cls in zip(ids, FLEET_PLAN, strict=True):
        spec = CLASS_SPECS[cls]
        is_seed_machine = machine_id == "EXC001"

        age_yrs = 2 if is_seed_machine else int(rng.integers(1, 9))
        size_t = round(rng.uniform(*spec["size_t"]), 1)
        power_kw = int(rng.uniform(*spec["power_kw"]))
        bucket_m3 = round(rng.uniform(*spec["bucket_m3"]), 2) if spec["bucket_m3"][1] > 0 else 0.0
        idle_lph = round(rng.uniform(3, 5), 2)
        work_lph = round(idle_lph * rng.uniform(3, 6), 2)
        fuel_tank_l = int(rng.uniform(250, 600))
        service_interval_hrs = int(rng.choice([250, 500]))
        hours_since_last_service = round(rng.uniform(0, service_interval_hrs * 1.1), 1)
        last_service_date = today - dt.timedelta(
            days=int(hours_since_last_service / 8)
        )  # ~8 operating hours/day assumption, documented below

        rows.append(
            {
                "machine_id": machine_id,
                "class": cls,
                "model_size_t": size_t,
                "engine_power_kw": power_kw,
                "bucket_capacity_m3": bucket_m3,
                "undercarriage_type": "track" if cls != "wheel_loader" else "wheel",
                "age_yrs": age_yrs,
                "purchase_year": today.year - age_yrs,
                "idle_lph": idle_lph,
                "work_lph": work_lph,
                "fuel_tank_capacity_l": fuel_tank_l,
                "blind_spot_profile": BLIND_SPOT_PROFILE[cls],
                "gps_enabled": bool(rng.random() < 0.9),
                "last_service_date": last_service_date.isoformat(),
                "service_interval_hrs": service_interval_hrs,
                "hours_since_last_service": hours_since_last_service,
                "fault_code_history_count": int(rng.poisson(1 + age_yrs * 0.4)),
                "avg_daily_utilization_hrs": round(rng.uniform(5, 9), 1),
            }
        )

    return pd.DataFrame(rows)


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    df = generate(config)
    out_path = GENERATED_DIR / "machines.csv"
    df.to_csv(out_path, index=False)
    print(f"[machines] wrote {len(df)} rows -> {out_path}")

    append_calibration_note(
        "Fleet (machines.csv)",
        [
            "- Fleet mix: 6 excavators / 4 wheel loaders / 2 dozers (12 total), per "
            "CLAUDE.md section 5.1.",
            "- `blind_spot_profile` follows ISO 5006 (operator field of view) — excavators "
            "get a rear swing blind spot, wheel loaders a front bucket blind spot, dozers "
            "a wide rear blind spot.",
            "- `idle_lph`/`work_lph` sampled to land in the fleet idle-fuel-burn band from "
            "CLAUDE.md section 5 (idle 3-5 L/h, work 3-6x idle).",
            "- `last_service_date` is backed out from `hours_since_last_service` assuming "
            "~8 operating hours/day fleet-wide — an assumption, not measured data.",
            "- EXC001 is pinned to age_yrs=2 and class=excavator so it matches "
            "telemetry_seed.csv verbatim.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
