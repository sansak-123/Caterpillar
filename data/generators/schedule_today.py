"""Generate schedule_today.csv — CLAUDE.md section 5.1.

The demo-day (config.demo_day) schedule, 2-3 tasks per operator, reusing tasks.py's own
row-building logic so schedule_today.csv is statistically consistent with tasks.csv
rather than a second, drifting model.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd
from tasks import _build_row

from common import GENERATED_DIR, append_calibration_note, ensure_dirs, get_rng, load_config


def generate(config: dict) -> pd.DataFrame:
    rng = get_rng(config, "schedule_today")
    machines = pd.read_csv(GENERATED_DIR / "machines.csv")
    operators = pd.read_csv(GENERATED_DIR / "operators.csv")
    sites = pd.read_csv(GENERATED_DIR / "sites.csv")
    demo_day = dt.date.fromisoformat(config["demo_day"])

    rows = []
    for _, operator in operators.iterrows():
        n_tasks = int(rng.integers(2, 4))
        for slot in range(n_tasks):
            task_id = f"SCHED-{operator['operator_id']}-{slot + 1}"
            row = _build_row(
                rng,
                config,
                task_id,
                machines,
                operators,
                sites,
                [demo_day],
                forced=None,
                forced_operator_id=operator["operator_id"],
            )
            row["slot"] = slot + 1
            rows.append(row)

    df = pd.DataFrame(rows)
    df = df.rename(columns={"_date": "task_date"})
    df["task_date"] = pd.to_datetime(df["task_date"]).dt.date.astype(str)
    df["site_congestion_index_at_start"] = 0.5  # single-day schedule, no cross-day comparison to derive this from
    df["task_sequence_number_in_shift"] = df.groupby("operator_id").cumcount() + 1
    df["previous_task_overrun_ratio"] = np.nan
    return df.sort_values(["operator_id", "slot"]).reset_index(drop=True)


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    for needed in ("machines.csv", "operators.csv", "sites.csv"):
        if not (GENERATED_DIR / needed).exists():
            raise SystemExit(f"Run the generator for {needed} first.")

    df = generate(config)
    out_path = GENERATED_DIR / "schedule_today.csv"
    df.to_csv(out_path, index=False)
    print(f"[schedule_today] wrote {len(df)} rows for {config['demo_day']} -> {out_path}")

    append_calibration_note(
        "Demo-day schedule (schedule_today.csv)",
        [
            "- 2-3 tasks per operator on `config.demo_day`, built with the exact same "
            "`_build_row` model as tasks.csv (imported directly) so the demo schedule "
            "isn't a second, independently-drifting statistical model.",
            "- `site_congestion_index_at_start` is fixed at 0.5 here (a single day has no "
            "cross-day baseline to compare against) and `previous_task_overrun_ratio` is "
            "left null — both are meaningful only in the full multi-day tasks.csv.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
