"""Generate idle_tags.csv — CLAUDE.md section 5.1 / USP-3 Idle Intent Tagging.

Every contiguous idle window in telemetry_1min.parquet gets a ground-truth `reason`
label, so ml/anomaly (Phase 3) has something to evaluate "operator habit vs site
bottleneck" classification against.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from common import GENERATED_DIR, LABELS_DIR, append_calibration_note, ensure_dirs, get_rng, load_config


def _extract_idle_windows(telemetry: pd.DataFrame) -> pd.DataFrame:
    idle = telemetry.loc[
        telemetry["state"] == "idle",
        ["machine_id", "operator_id", "site_id", "ts", "gps_lat", "gps_lon", "nearby_machines_count"],
    ].sort_values(["machine_id", "ts"])

    gap = idle.groupby("machine_id")["ts"].diff().dt.total_seconds().gt(90)
    idle = idle.assign(window_group=gap.groupby(idle["machine_id"]).cumsum())

    windows = idle.groupby(["machine_id", "window_group"], as_index=False).agg(
        operator_id=("operator_id", "first"),
        site_id=("site_id", "first"),
        ts_start=("ts", "first"),
        ts_end=("ts", "last"),
        duration_min=("ts", "size"),
        gps_lat=("gps_lat", "first"),
        gps_lon=("gps_lon", "first"),
        nearby_machines_count=("nearby_machines_count", "mean"),
    )
    return windows.drop(columns="window_group")


def _assign_reason(rng: np.random.Generator, windows: pd.DataFrame, spikes: pd.DataFrame) -> pd.Series:
    is_first_of_day = (
        windows.sort_values(["machine_id", "ts_start"]).groupby(
            [windows["machine_id"], windows["ts_start"].dt.date]
        ).cumcount()
        == 0
    )
    is_spike = pd.Series(False, index=windows.index)
    if not spikes.empty:
        spike_keys = set(zip(spikes["machine_id"], spikes["date"], strict=True))
        is_spike = windows.apply(
            lambda r: (r["machine_id"], r["ts_start"].date().isoformat()) in spike_keys, axis=1
        )

    reasons = np.empty(len(windows), dtype=object)
    for i, (dur, first, spike) in enumerate(
        zip(windows["duration_min"], is_first_of_day, is_spike, strict=True)
    ):
        if first and dur <= 8:
            reasons[i] = "warmup"
        elif spike or dur > 30:
            reasons[i] = rng.choice(["unjustified", "truck_wait", "break"], p=[0.65, 0.25, 0.10])
        elif dur >= 10:
            reasons[i] = rng.choice(["truck_wait", "break", "unjustified"], p=[0.5, 0.3, 0.2])
        else:
            reasons[i] = rng.choice(["truck_wait", "unjustified", "break"], p=[0.6, 0.25, 0.15])
    return pd.Series(reasons, index=windows.index)


def generate(config: dict) -> pd.DataFrame:
    rng = get_rng(config, "idle_tags")
    telemetry = pd.read_parquet(GENERATED_DIR / "telemetry_1min.parquet")
    labels_path = LABELS_DIR / "telemetry_anomalies.csv"
    spikes = pd.read_csv(labels_path)
    spikes = spikes[spikes["anomaly_type"] == "idle_spike"] if not spikes.empty else spikes

    windows = _extract_idle_windows(telemetry)
    windows["reason"] = _assign_reason(rng, windows, spikes)
    windows["queue_position_estimate"] = np.where(
        windows["reason"] == "truck_wait", rng.integers(0, 4, len(windows)), 0
    )
    windows["gps_location"] = windows.apply(lambda r: f"{r['gps_lat']:.5f},{r['gps_lon']:.5f}", axis=1)
    windows["nearby_machines_count"] = windows["nearby_machines_count"].round(1)

    windows = windows.sort_values(["machine_id", "ts_start"]).reset_index(drop=True)
    windows.insert(0, "window_id", [f"IDLE{i + 1:06d}" for i in range(len(windows))])

    cols = [
        "window_id",
        "machine_id",
        "operator_id",
        "site_id",
        "ts_start",
        "ts_end",
        "duration_min",
        "reason",
        "gps_location",
        "nearby_machines_count",
        "queue_position_estimate",
    ]
    return windows[cols]


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    if not (GENERATED_DIR / "telemetry_1min.parquet").exists():
        raise SystemExit("Run telemetry.py first.")

    df = generate(config)
    out_path = GENERATED_DIR / "idle_tags.csv"
    df.to_csv(out_path, index=False)
    print(f"[idle_tags] wrote {len(df)} idle windows -> {out_path}")
    print(df["reason"].value_counts().to_string())

    append_calibration_note(
        "Idle intent labels (idle_tags.csv, USP-3)",
        [
            "- Every contiguous idle run (gap <= 90s) becomes one window. Ground-truth "
            "`reason` is a heuristic, not a real operator response: the first idle "
            "window of a machine-day under 8 minutes is `warmup`; windows over 30 "
            "minutes or flagged as an injected `idle_spike` anomaly skew heavily toward "
            "`unjustified`; everything else skews toward `truck_wait` (the intended "
            "'site bottleneck, not operator habit' case from CLAUDE.md section 6).",
            "- `queue_position_estimate` is only meaningful (non-zero) when "
            "reason=truck_wait — a simple stand-in for 'how many trucks are ahead'.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
