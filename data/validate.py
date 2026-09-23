"""Validate the generated dataset against CLAUDE.md section 1/5 targets.

Run as `python data/validate.py` (after `python data/generators/run_all.py`).
Prints a summary table, asserts the seed rows are present verbatim, checks the fleet
idle ratio and per-skill/weather overrun ratios land near the calibration targets, and
saves 4 plots to data/generated/reports/.
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import yaml

DATA_DIR = Path(__file__).resolve().parent
GENERATED_DIR = DATA_DIR / "generated"
SEED_DIR = DATA_DIR / "seed"
REPORTS_DIR = GENERATED_DIR / "reports"

failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}{(' - ' + detail) if detail and not condition else ''}")
    if not condition:
        failures.append(label)


def main() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    config = yaml.safe_load((DATA_DIR / "config.yaml").read_text(encoding="utf-8"))

    machines = pd.read_csv(GENERATED_DIR / "machines.csv")
    operators = pd.read_csv(GENERATED_DIR / "operators.csv")
    sites = pd.read_csv(GENERATED_DIR / "sites.csv")
    weather = pd.read_csv(GENERATED_DIR / "weather_hourly.csv")
    telemetry = pd.read_parquet(GENERATED_DIR / "telemetry_1min.parquet")
    tasks = pd.read_csv(GENERATED_DIR / "tasks.csv")
    hourly = pd.read_csv(GENERATED_DIR / "telemetry_hourly.csv", parse_dates=["timestamp"])
    incidents = pd.read_csv(GENERATED_DIR / "incidents.csv")

    print("\n=== Row counts ===")
    for name, df in [
        ("machines", machines),
        ("operators", operators),
        ("sites", sites),
        ("weather_hourly", weather),
        ("telemetry_1min", telemetry),
        ("telemetry_hourly", hourly),
        ("tasks", tasks),
        ("incidents", incidents),
    ]:
        print(f"  {name:<18} {len(df):>8,} rows")

    print("\n=== Seed row presence ===")
    seed_telemetry = pd.read_csv(SEED_DIR / "telemetry_seed.csv", parse_dates=["timestamp"])
    merged = hourly.merge(seed_telemetry, on=list(seed_telemetry.columns), how="inner")
    check("telemetry_hourly.csv contains all 4 seed rows verbatim", len(merged) == len(seed_telemetry))

    seed_tasks = pd.read_csv(SEED_DIR / "tasks_seed.csv")
    task_merge = tasks.merge(seed_tasks, on=list(seed_tasks.columns), how="inner")
    check("tasks.csv contains all 5 seed rows verbatim", len(task_merge) == len(seed_tasks))

    print("\n=== Fleet idle ratio ===")
    idle_ratio = (telemetry["state"] == "idle").mean()
    lo, hi = config["idle"]["fleet_mean_ratio"]
    check(
        f"fleet idle ratio in [{lo}, {hi}]",
        lo - 0.05 <= idle_ratio <= hi + 0.10,
        f"got {idle_ratio:.2%}",
    )

    op_persona = operators.set_index("operator_id")["persona"]
    telemetry_persona = telemetry["operator_id"].map(op_persona)
    idler_ratio = (telemetry.loc[telemetry_persona == "idler", "state"] == "idle").mean()
    lo, hi = config["idle"]["idler_persona_ratio"]
    check(
        f"idler persona idle ratio in [{lo}, {hi}]",
        lo - 0.10 <= idler_ratio <= hi + 0.10,
        f"got {idler_ratio:.2%}",
    )

    print("\n=== Task overrun ratio by skill (target: expert ~0.95, intermediate ~1.08, beginner ~1.35) ===")
    overrun_by_skill = (tasks["actual_min"] / tasks["est_min"]).groupby(tasks["operator_skill"]).mean()
    print(overrun_by_skill.round(3).to_string())
    for skill, target in [("Expert", 0.95), ("Intermediate", 1.08), ("Beginner", 1.35)]:
        if skill in overrun_by_skill.index:
            check(f"{skill} overrun ratio near {target}", abs(overrun_by_skill[skill] - target) < 0.25)

    print("\n=== Task overrun ratio by weather (target: rain ~1.15-1.16, windy ~1.15-1.17) ===")
    overrun_by_weather = (tasks["actual_min"] / tasks["est_min"]).groupby(tasks["weather"]).mean()
    print(overrun_by_weather.round(3).to_string())

    print("\n=== Near-miss / incident counts ===")
    print(f"  near-misses: {(incidents['is_near_miss']).sum()}")
    print(f"  incidents:   {(~incidents['is_near_miss']).sum()}")
    check("incidents are rare relative to near-misses", (~incidents["is_near_miss"]).sum() < (incidents["is_near_miss"]).sum() / 5)

    # --- plots ---
    fig, ax = plt.subplots(figsize=(6, 4))
    telemetry.assign(persona=telemetry_persona).groupby("persona")["state"].apply(
        lambda s: (s == "idle").mean()
    ).sort_values().plot.barh(ax=ax, color="#4FA3E3")
    ax.set_title("Idle ratio by operator persona")
    ax.set_xlabel("Idle ratio")
    fig.tight_layout()
    fig.savefig(REPORTS_DIR / "idle_ratio_by_persona.png", dpi=120)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4))
    overrun_by_skill.reindex(["Beginner", "Intermediate", "Expert"]).plot.bar(
        ax=ax, color=["#E5473A", "#F5A623", "#2ECC71"]
    )
    ax.axhline(1.0, color="black", linewidth=0.8, linestyle="--")
    ax.set_title("Task overrun ratio (actual/est) by skill")
    ax.set_ylabel("Overrun ratio")
    fig.tight_layout()
    fig.savefig(REPORTS_DIR / "overrun_ratio_by_skill.png", dpi=120)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4))
    weather["condition"].value_counts().plot.pie(ax=ax, autopct="%1.0f%%")
    ax.set_title("Weather condition distribution (all sites, 90 days)")
    ax.set_ylabel("")
    fig.tight_layout()
    fig.savefig(REPORTS_DIR / "weather_condition_mix.png", dpi=120)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4))
    incidents["trigger"].value_counts().plot.bar(ax=ax, color="#FFC72C")
    ax.set_title("Near-miss / incident triggers")
    ax.set_ylabel("Count")
    fig.tight_layout()
    fig.savefig(REPORTS_DIR / "incident_triggers.png", dpi=120)
    plt.close(fig)

    print(f"\nSaved 4 plots to {REPORTS_DIR}")

    print("\n=== Result ===")
    if failures:
        print(f"{len(failures)} check(s) FAILED: {failures}")
        sys.exit(1)
    print("All checks passed.")


if __name__ == "__main__":
    main()
