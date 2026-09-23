"""Train the task-time quantile models — CLAUDE.md section 6.

LightGBM quantile regressors (alpha 0.5, 0.9) predicting the overrun ratio
(actual_min/est_min). Time-based split (sorted by task_date, last 20% held out).
Exports both to ONNX and verifies parity, writes feature_schema.json, and prints
MAE-vs-baseline / P90 coverage / per-seed-row performance / SHAP-derived reason
sentences for judges.

Run as `python ml/task_time/train.py` from the repo root.
"""

from __future__ import annotations

import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import onnxruntime as ort
import pandas as pd
import shap
from onnxmltools import convert_lightgbm
from onnxmltools.convert.common.data_types import FloatTensorType

from features import (
    FEATURE_COLUMNS,
    build_feature_frame,
    encode_categoricals,
    save_feature_schema,
)

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
SEED_TASK_IDS = ["T001", "T002", "T003", "T004", "T005"]


def time_based_split(df: pd.DataFrame, test_frac: float = 0.2) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = df.sort_values("task_date")
    cutoff = int(len(df) * (1 - test_frac))
    return df.iloc[:cutoff], df.iloc[cutoff:]


def train_quantile_model(X: pd.DataFrame, y: pd.Series, alpha: float) -> lgb.LGBMRegressor:
    model = lgb.LGBMRegressor(
        objective="quantile",
        alpha=alpha,
        n_estimators=300,
        num_leaves=31,
        learning_rate=0.05,
        min_child_samples=20,
        verbosity=-1,
    )
    model.fit(X, y)
    return model


def mae(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.mean(np.abs(a - b)))


def shap_top3_sentences(model: lgb.LGBMRegressor, X: pd.DataFrame, row_idx: int, est_min: float) -> list[str]:
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X.iloc[[row_idx]])[0]
    contributions = sorted(zip(X.columns, shap_values, strict=True), key=lambda t: -abs(t[1]))[:3]
    sentences = []
    for feature, value in contributions:
        minutes = value * est_min
        sign = "+" if minutes >= 0 else ""
        sentences.append(f"{sign}{minutes:.0f} min: {feature}")
    return sentences


def export_to_onnx(model: lgb.LGBMRegressor, n_features: int, path: Path) -> None:
    onnx_model = convert_lightgbm(
        model, initial_types=[("input", FloatTensorType([None, n_features]))], target_opset=13
    )
    path.write_bytes(onnx_model.SerializeToString())


def verify_onnx_parity(model: lgb.LGBMRegressor, onnx_path: Path, X: pd.DataFrame) -> float:
    session = ort.InferenceSession(str(onnx_path))
    input_name = session.get_inputs()[0].name
    onnx_pred = session.run(None, {input_name: X.to_numpy(dtype=np.float32)})[0].reshape(-1)
    native_pred = model.predict(X)
    return float(np.max(np.abs(onnx_pred - native_pred)))


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    tasks = build_feature_frame()
    encoded, categories = encode_categoricals(tasks)

    train_df, test_df = time_based_split(encoded)
    X_train, y_train = train_df[FEATURE_COLUMNS], train_df["overrun_ratio"]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df["overrun_ratio"]

    model_p50 = train_quantile_model(X_train, y_train, alpha=0.5)
    model_p90 = train_quantile_model(X_train, y_train, alpha=0.9)

    pred_ratio_p50 = model_p50.predict(X_test)
    pred_ratio_p90 = model_p90.predict(X_test)
    pred_min_p50 = test_df["est_min"].to_numpy() * pred_ratio_p50
    pred_min_p90 = test_df["est_min"].to_numpy() * pred_ratio_p90
    baseline_min = test_df["est_min"].to_numpy()
    actual_min = test_df["actual_min"].to_numpy()

    model_mae = mae(actual_min, pred_min_p50)
    baseline_mae = mae(actual_min, baseline_min)
    p90_coverage = float(np.mean(actual_min <= pred_min_p90))

    print(f"[task_time] test rows: {len(test_df)}")
    print(f"[task_time] baseline MAE (planner est_min):     {baseline_mae:.2f} min")
    print(f"[task_time] model MAE (P50 prediction):          {model_mae:.2f} min")
    print(f"[task_time] improvement over baseline:           {(1 - model_mae / baseline_mae) * 100:.1f}%")
    print(f"[task_time] P90 coverage (target ~90%):          {p90_coverage:.1%}")

    print("\n[task_time] Seed row performance:")
    seed_rows = encoded[encoded["task_id"].isin(SEED_TASK_IDS)].sort_values("task_id")
    for _, row in seed_rows.iterrows():
        x_row = row[FEATURE_COLUMNS].to_frame().T.astype(X_train.dtypes.to_dict())
        p50 = float(model_p50.predict(x_row)[0]) * row["est_min"]
        p90 = float(model_p90.predict(x_row)[0]) * row["est_min"]
        task_type_name = categories["task_type"][int(row["task_type"])]
        print(
            f"  {row['task_id']} ({task_type_name}): actual={row['actual_min']:.0f}min "
            f"est={row['est_min']:.0f}min pred_p50={p50:.0f}min pred_p90={p90:.0f}min"
        )

    print("\n[task_time] SHAP top-3 reasons for a sample of test rows:")
    for i in list(range(min(3, len(X_test)))):
        row = test_df.iloc[i]
        sentences = shap_top3_sentences(model_p50, X_test, i, row["est_min"])
        print(f"  {row['task_id']}: {sentences}")

    onnx_p50_path = ARTIFACTS_DIR / "task_time_p50.onnx"
    onnx_p90_path = ARTIFACTS_DIR / "task_time_p90.onnx"
    export_to_onnx(model_p50, len(FEATURE_COLUMNS), onnx_p50_path)
    export_to_onnx(model_p90, len(FEATURE_COLUMNS), onnx_p90_path)

    max_diff_p50 = verify_onnx_parity(model_p50, onnx_p50_path, X_test)
    max_diff_p90 = verify_onnx_parity(model_p90, onnx_p90_path, X_test)
    print(f"\n[task_time] ONNX parity (max abs diff): p50={max_diff_p50:.2e} p90={max_diff_p90:.2e}")
    assert max_diff_p50 < 1e-4, "P50 ONNX export does not match native predictions within 1e-4"
    assert max_diff_p90 < 1e-4, "P90 ONNX export does not match native predictions within 1e-4"

    save_feature_schema(categories, ARTIFACTS_DIR / "feature_schema.json")

    # Global feature importances + training-set means, used by the backend/device for a
    # lightweight "approximate (offline)" reasons[] at serving time (CLAUDE.md section
    # 3.1) — full per-request SHAP only runs at bundle-build time (see the SHAP sample
    # above), not on every live prediction.
    importances = dict(
        sorted(
            zip(FEATURE_COLUMNS, model_p50.feature_importances_.tolist(), strict=True),
            key=lambda kv: -kv[1],
        )
    )
    feature_means = X_train.mean(numeric_only=True).to_dict()
    (ARTIFACTS_DIR / "feature_importances.json").write_text(
        json.dumps({"importances": importances, "training_means": feature_means}, indent=2),
        encoding="utf-8",
    )

    metrics = {
        "test_rows": len(test_df),
        "baseline_mae_min": baseline_mae,
        "model_mae_min": model_mae,
        "improvement_pct": (1 - model_mae / baseline_mae) * 100,
        "p90_coverage": p90_coverage,
        "onnx_max_abs_diff_p50": max_diff_p50,
        "onnx_max_abs_diff_p90": max_diff_p90,
    }
    (ARTIFACTS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"\n[task_time] artifacts written to {ARTIFACTS_DIR}")


if __name__ == "__main__":
    main()
