"""Near-miss hotspot analytics — CLAUDE.md section 6: "hotspots by site, time, machine
sector (rear vs front), and conditions." Builds directly on incidents.csv (already
derived from telemetry by data/generators/incidents.py) rather than re-deriving
near-misses from raw telemetry a second time.

Run as `python ml/near_miss/hotspots.py` from the repo root.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

DATA_GENERATED = Path(__file__).resolve().parents[2] / "data" / "generated"
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

SECTOR_BY_TRIGGER = {
    "red_zone_swing": "front/side (swing radius)",
    "red_zone_reverse": "rear (blind spot)",
    "belt_off_travel": "n/a (belt, not proximity)",
}


def load_near_misses() -> pd.DataFrame:
    df = pd.read_csv(DATA_GENERATED / "incidents.csv", parse_dates=["ts"])
    df = df[df["is_near_miss"]].copy()
    machines = pd.read_csv(DATA_GENERATED / "machines.csv")[["machine_id", "class"]]
    df = df.merge(machines, on="machine_id", how="left")
    df["sector"] = df["trigger"].map(SECTOR_BY_TRIGGER).fillna("unknown")
    df["hour"] = df["ts"].dt.hour
    return df


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    df = load_near_misses()

    by_machine = df.groupby("machine_id").size().sort_values(ascending=False)
    by_hour = df.groupby("hour").size().sort_index()
    by_sector = df.groupby("sector").size().sort_values(ascending=False)
    by_condition = df.groupby("weather_at_time").size().sort_values(ascending=False)
    by_machine_class = df.groupby("class").size().sort_values(ascending=False)

    print(f"[near_miss] {len(df)} near-misses analyzed\n")
    print("By machine (top 5):")
    print(by_machine.head(5).to_string())
    print("\nBy hour of day:")
    print(by_hour.to_string())
    print("\nBy sector:")
    print(by_sector.to_string())
    print("\nBy weather condition at time of event:")
    print(by_condition.to_string())
    print("\nBy machine class:")
    print(by_machine_class.to_string())

    worst_hour = int(by_hour.idxmax())
    worst_sector = str(by_sector.idxmax())
    worst_condition = str(by_condition.idxmax())
    print(
        f"\n[near_miss] Hotspot summary: most near-misses occur around {worst_hour}:00, "
        f"in the {worst_sector} sector, during {worst_condition} conditions."
    )

    summary = {
        "total_near_misses": len(df),
        "by_machine": by_machine.to_dict(),
        "by_hour": by_hour.to_dict(),
        "by_sector": by_sector.to_dict(),
        "by_condition": by_condition.to_dict(),
        "by_machine_class": by_machine_class.to_dict(),
        "worst_hour": worst_hour,
        "worst_sector": worst_sector,
        "worst_condition": worst_condition,
    }
    (ARTIFACTS_DIR / "hotspots.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    print(f"\n[near_miss] artifacts written to {ARTIFACTS_DIR}")


if __name__ == "__main__":
    main()
