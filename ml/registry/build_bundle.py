"""Builds a versioned model bundle from ml/task_time/artifacts and registers it with
the backend (POST /model-bundles) — CLAUDE.md section 3.1: "cloud trains; publishes
versioned bundle {version, task_time.onnx, thresholds.json, feature_schema.json}."

Run as `python ml/registry/build_bundle.py` from the repo root. Registration against
the backend is best-effort: if the API isn't reachable (e.g. no Postgres running
locally), the bundle is still built on disk and a note is printed.
"""

from __future__ import annotations

import datetime as dt
import json
import shutil
from pathlib import Path

import httpx

TASK_TIME_ARTIFACTS = Path(__file__).resolve().parents[1] / "task_time" / "artifacts"
BUNDLES_DIR = Path(__file__).resolve().parent / "bundles"
BACKEND_URL = "http://127.0.0.1:8000"

# Consolidates the rule constants used across the safety/anomaly engines so the device
# can run fully offline without re-deriving them — CLAUDE.md section 6.
THRESHOLDS = {
    "idle_ratio_alert_threshold": 0.60,
    "idle_min_fallback_threshold": 45,
    "seatbelt_soft_reminder_idle": True,
    "proximity_base_radius_m": {"excavator": 12.0, "wheel_loader": 10.0, "dozer": 14.0},
    "proximity_rear_sector_multiplier": 1.5,
    "proximity_swing_reverse_state_multiplier": 1.3,
    "anomaly_isolation_forest_contamination": 0.05,
    "anomaly_zscore_strong_outlier": 1.5,
    "near_miss_gap_seconds": 120,
}


def build_bundle() -> Path:
    version = dt.datetime.utcnow().strftime("v%Y%m%d%H%M%S")
    bundle_dir = BUNDLES_DIR / version
    bundle_dir.mkdir(parents=True, exist_ok=True)

    for name in ("task_time_p50.onnx", "task_time_p90.onnx", "feature_schema.json", "feature_importances.json"):
        src = TASK_TIME_ARTIFACTS / name
        if not src.exists():
            raise SystemExit(f"Missing {src} — run ml/task_time/train.py first.")
        shutil.copy(src, bundle_dir / name)

    (bundle_dir / "thresholds.json").write_text(json.dumps(THRESHOLDS, indent=2), encoding="utf-8")

    meta = {
        "version": version,
        "task_time_p50_uri": f"bundles/{version}/task_time_p50.onnx",
        "task_time_p90_uri": f"bundles/{version}/task_time_p90.onnx",
        "published_at": dt.datetime.utcnow().isoformat(),
    }
    (bundle_dir / "bundle_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[registry] built bundle {version} -> {bundle_dir}")
    return bundle_dir


def register_with_backend(bundle_dir: Path, token: str | None = None) -> None:
    meta = json.loads((bundle_dir / "bundle_meta.json").read_text(encoding="utf-8"))
    payload = {
        "version": meta["version"],
        "task_time_p50_uri": meta["task_time_p50_uri"],
        "task_time_p90_uri": meta["task_time_p90_uri"],
        "thresholds_json": (bundle_dir / "thresholds.json").read_text(encoding="utf-8"),
        "feature_schema_json": (bundle_dir / "feature_schema.json").read_text(encoding="utf-8"),
    }
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        resp = httpx.post(f"{BACKEND_URL}/model-bundles/register", json=payload, headers=headers, timeout=5.0)
        resp.raise_for_status()
        print(f"[registry] registered {meta['version']} with backend at {BACKEND_URL}")
    except httpx.HTTPError as exc:
        print(f"[registry] backend not reachable ({exc}) — bundle is built on disk only, register later")


if __name__ == "__main__":
    directory = build_bundle()
    register_with_backend(directory)
