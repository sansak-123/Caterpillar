"""Loads the task-time ONNX bundle and serves predictions in the
`{value, range, reasons[]}` shape every ML output uses (CLAUDE.md section 8).

Falls back to ml/task_time/artifacts directly when no bundle has been registered in the
DB yet (e.g. local dev without Postgres) — see ml/registry/build_bundle.py.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np
import onnxruntime as ort

REPO_ROOT = Path(__file__).resolve().parents[3]
FALLBACK_ARTIFACTS = REPO_ROOT / "ml" / "task_time" / "artifacts"


class TaskTimeModel:
    def __init__(self, artifacts_dir: Path) -> None:
        self.schema = json.loads(
            (artifacts_dir / "feature_schema.json").read_text(encoding="utf-8")
        )
        importance_data = json.loads(
            (artifacts_dir / "feature_importances.json").read_text(encoding="utf-8")
        )
        self.importances: dict[str, float] = importance_data["importances"]
        self.training_means: dict[str, float] = importance_data["training_means"]
        self.session_p50 = ort.InferenceSession(str(artifacts_dir / "task_time_p50.onnx"))
        self.session_p90 = ort.InferenceSession(str(artifacts_dir / "task_time_p90.onnx"))
        self.input_name = self.session_p50.get_inputs()[0].name

    def _encode(self, features: dict) -> np.ndarray:
        row = []
        for col in self.schema["features"]:
            value = features.get(col)
            if col in self.schema["categorical_encodings"]:
                cats = self.schema["categorical_encodings"][col]
                row.append(float(cats.index(value)) if value in cats else -1.0)
            elif value is None:
                row.append(float(self.training_means.get(col, 0.0)))
            elif isinstance(value, bool):
                row.append(float(int(value)))
            else:
                row.append(float(value))
        return np.array([row], dtype=np.float32)

    def _reasons(self, features: dict, est_min: float) -> list[str]:
        """Approximate reasons — global feature importance x how far this request's
        value sits from the training mean, NOT a per-request SHAP value. Full SHAP
        only runs at training/bundle-build time (see ml/task_time/train.py); this is
        the "approximate (offline)" tier CLAUDE.md section 3.1 describes."""
        top_features = list(self.importances.items())[:3]
        reasons = []
        for feature, _importance in top_features:
            value = features.get(feature)
            mean = self.training_means.get(feature)
            if value is None or mean is None or feature in self.schema["categorical_encodings"]:
                reasons.append(f"{feature} (approximate)")
                continue
            direction = "above" if value > mean else "below"
            reasons.append(f"{feature} {direction} typical (approximate)")
        return reasons

    def predict(self, features: dict, est_min: float) -> dict:
        x = self._encode(features)
        ratio_p50 = float(self.session_p50.run(None, {self.input_name: x})[0].reshape(-1)[0])
        ratio_p90 = float(self.session_p90.run(None, {self.input_name: x})[0].reshape(-1)[0])
        p50_min = round(est_min * ratio_p50, 1)
        p90_min = round(est_min * max(ratio_p90, ratio_p50), 1)
        return {
            "value": p50_min,
            "range": [p50_min, p90_min],
            "reasons": self._reasons(features, est_min),
        }


@lru_cache(maxsize=1)
def get_task_time_model() -> TaskTimeModel:
    return TaskTimeModel(FALLBACK_ARTIFACTS)
