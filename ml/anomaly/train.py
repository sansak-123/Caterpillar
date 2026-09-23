"""Unusual-behaviour (anomaly) detection — CLAUDE.md section 6.

15-minute window features + per-operator baseline z-scores + IsolationForest, evaluated
against the labels injected by data/generators/telemetry.py (idle_spike, belt_off_travel,
rushing) with precision/recall. Every flagged window gets a plain-language reason string,
and idle_tags.csv is used to split "operator habit" (reason=unjustified) from "site
bottleneck" (reason=truck_wait) among the flagged idle windows.

Run as `python ml/anomaly/train.py` from the repo root.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

DATA_GENERATED = Path(__file__).resolve().parents[2] / "data" / "generated"
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
WINDOW = "15min"
CONTAMINATION = 0.05


def build_window_features() -> pd.DataFrame:
    telemetry = pd.read_parquet(
        DATA_GENERATED / "telemetry_1min.parquet",
        columns=["ts", "machine_id", "operator_id", "state", "seatbelt", "swing_rate_dps", "fuel_rate_lph"],
    )
    telemetry["window"] = telemetry["ts"].dt.floor(WINDOW)
    telemetry["date"] = telemetry["ts"].dt.date

    grouped = telemetry.groupby(["machine_id", "operator_id", "window"])
    features = grouped.agg(
        date=("date", "first"),
        n_minutes=("state", "size"),
        idle_ratio=("state", lambda s: (s == "idle").mean()),
        work_minutes=("state", lambda s: (s == "work").sum()),
        swing_rate_p95=("swing_rate_dps", lambda s: np.percentile(s, 95)),
        avg_fuel_rate_lph=("fuel_rate_lph", "mean"),
        belt_violations=("seatbelt", lambda s: (s == "Unfastened").sum()),
    ).reset_index()

    features["load_cycles_proxy"] = np.ceil(features["work_minutes"] / 4)
    features["cycles_per_engine_hour"] = features["load_cycles_proxy"] / (features["n_minutes"] / 60)
    window_hours = features["n_minutes"] / 60
    features["fuel_per_cycle_l"] = (features["avg_fuel_rate_lph"] * window_hours) / features[
        "load_cycles_proxy"
    ].clip(lower=1)
    features["hour_of_day"] = features["window"].dt.hour
    features["off_hours"] = ((features["hour_of_day"] < 6) | (features["hour_of_day"] > 20)).astype(int)
    return features


FEATURE_COLS = ["idle_ratio", "fuel_per_cycle_l", "belt_violations", "swing_rate_p95", "cycles_per_engine_hour"]


def add_operator_zscores(features: pd.DataFrame) -> pd.DataFrame:
    grouped = features.groupby("operator_id")[FEATURE_COLS]
    means = grouped.transform("mean").add_suffix("_baseline")
    zscores = grouped.transform(lambda s: (s - s.mean()) / (s.std() + 1e-6)).add_suffix("_z")
    return features.join(means).join(zscores)


def build_ground_truth(features: pd.DataFrame) -> pd.Series:
    labels = pd.read_csv(DATA_GENERATED / "labels" / "telemetry_anomalies.csv")
    day_level = labels[labels["anomaly_type"].isin(["idle_spike", "rushing"])]
    day_level_keys = set(zip(day_level["machine_id"], pd.to_datetime(day_level["date"]).dt.date, strict=True))

    belt_off = labels[labels["anomaly_type"] == "belt_off_travel"].copy()
    if not belt_off.empty:
        belt_off["ts_start"] = pd.to_datetime(belt_off["ts_start"])
        belt_off["ts_end"] = pd.to_datetime(belt_off["ts_end"])

    def _is_positive(row) -> bool:
        if (row["machine_id"], row["date"]) in day_level_keys:
            return True
        if belt_off.empty:
            return False
        overlap = belt_off[
            (belt_off["machine_id"] == row["machine_id"])
            & (belt_off["ts_start"] <= row["window"] + pd.Timedelta(WINDOW))
            & (belt_off["ts_end"] >= row["window"])
        ]
        return not overlap.empty

    return features.apply(_is_positive, axis=1)


def reason_string(row: pd.Series) -> str:
    """Every flagged window gets a sentence naming its most distinctive feature(s), so
    IsolationForest's multivariate score is never presented to an operator/supervisor
    as an unexplained black-box flag."""
    candidates = [
        ("idle_ratio_z", f"idle ratio {row['idle_ratio']:.0%} vs your usual {row['idle_ratio_baseline']:.0%}"),
        ("belt_violations_z", f"{int(row['belt_violations'])} belt-unfastened minute(s) this window"),
        ("swing_rate_p95_z", "unusually fast swing rate (rushing pattern)"),
        ("fuel_per_cycle_l_z", "high fuel per cycle vs your baseline"),
        ("cycles_per_engine_hour_z", "unusually low load-cycle throughput this window"),
    ]
    strong = [text for col, text in candidates if row[col] > 1.5]
    if strong:
        return "; ".join(strong)

    # no single feature crosses the strong-outlier bar — name the most elevated one
    # anyway so the flag is never presented as unexplained.
    top_col, top_text = max(candidates, key=lambda ct: row[ct[0]])
    return f"mildly elevated vs baseline: {top_text}"


def split_habit_vs_bottleneck(flagged: pd.DataFrame) -> pd.DataFrame:
    idle_tags = pd.read_csv(DATA_GENERATED / "idle_tags.csv", parse_dates=["ts_start"])
    idle_tags["window"] = idle_tags["ts_start"].dt.floor(WINDOW)
    idle_tags = idle_tags.drop_duplicates(subset=["machine_id", "window"], keep="first")
    reason_lookup = idle_tags.set_index(["machine_id", "window"])["reason"]

    def _classify(row) -> str:
        reason = reason_lookup.get((row["machine_id"], row["window"]))
        if reason == "truck_wait":
            return "site_bottleneck"
        if reason == "unjustified":
            return "operator_habit"
        return "unclassified"

    flagged = flagged.copy()
    flagged["habit_vs_bottleneck"] = flagged.apply(_classify, axis=1)
    return flagged


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    features = build_window_features()
    features = add_operator_zscores(features)
    features = features.dropna(subset=[f"{c}_z" for c in FEATURE_COLS])

    model = IsolationForest(n_estimators=200, contamination=CONTAMINATION, random_state=42)
    X = features[FEATURE_COLS].to_numpy()
    features["anomaly_pred"] = model.fit_predict(X) == -1
    features["anomaly_score"] = -model.score_samples(X)

    print(f"[anomaly] {len(features)} windows, {features['anomaly_pred'].sum()} flagged "
          f"({features['anomaly_pred'].mean():.1%})")

    ground_truth = build_ground_truth(features)
    tp = int((features["anomaly_pred"] & ground_truth).sum())
    fp = int((features["anomaly_pred"] & ~ground_truth).sum())
    fn = int((~features["anomaly_pred"] & ground_truth).sum())
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    print(f"[anomaly] ground-truth positives: {int(ground_truth.sum())}")
    print(f"[anomaly] precision={precision:.3f} recall={recall:.3f} (tp={tp} fp={fp} fn={fn})")

    flagged = features[features["anomaly_pred"]].copy()
    flagged["reason"] = flagged.apply(reason_string, axis=1)
    flagged = split_habit_vs_bottleneck(flagged)

    print("\n[anomaly] habit vs bottleneck among flagged idle-heavy windows:")
    print(flagged["habit_vs_bottleneck"].value_counts().to_string())

    print("\n[anomaly] sample flagged windows:")
    for _, row in flagged.sort_values("anomaly_score", ascending=False).head(5).iterrows():
        print(f"  {row['machine_id']} {row['operator_id']} {row['window']}: {row['reason']} "
              f"[{row['habit_vs_bottleneck']}]")

    out_cols = ["machine_id", "operator_id", "window", "anomaly_score", "reason", "habit_vs_bottleneck"]
    flagged[out_cols].to_csv(ARTIFACTS_DIR / "flagged_windows.csv", index=False)

    metrics = {
        "windows": len(features),
        "flagged": int(features["anomaly_pred"].sum()),
        "ground_truth_positives": int(ground_truth.sum()),
        "precision": precision,
        "recall": recall,
    }
    (ARTIFACTS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"\n[anomaly] artifacts written to {ARTIFACTS_DIR}")


if __name__ == "__main__":
    main()
