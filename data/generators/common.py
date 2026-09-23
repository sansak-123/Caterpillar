"""Shared paths, config loading and RNG for all data/generators/*.py scripts.

Run as `python data/generators/<script>.py` — each script imports this module as a
sibling (Python puts the script's own directory on sys.path), so no package install
is required.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any

import numpy as np
import yaml

DATA_DIR = Path(__file__).resolve().parent.parent
SEED_DIR = DATA_DIR / "seed"
GENERATED_DIR = DATA_DIR / "generated"
LABELS_DIR = GENERATED_DIR / "labels"
REPORTS_DIR = GENERATED_DIR / "reports"
CONFIG_PATH = DATA_DIR / "config.yaml"
CALIBRATION_PATH = DATA_DIR / "calibration.md"


def load_config() -> dict[str, Any]:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_rng(config: dict[str, Any], stream: str = "") -> np.random.Generator:
    """A dedicated RNG per named stream, all derived from the one config seed so a full
    `run_all.py` run is reproducible end to end but different scripts don't accidentally
    correlate through a shared global generator."""
    base_seed = int(config["random_seed"])
    seed_material = f"{base_seed}:{stream}"
    seed = np.random.SeedSequence([base_seed, abs(hash(seed_material)) % (2**32)])
    return np.random.default_rng(seed)


def start_date(config: dict[str, Any]) -> dt.date:
    return dt.date.fromisoformat(config["start_date"])


def date_range(config: dict[str, Any]) -> list[dt.date]:
    d0 = start_date(config)
    return [d0 + dt.timedelta(days=i) for i in range(int(config["days"]))]


def ensure_dirs() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def append_calibration_note(section: str, lines: list[str]) -> None:
    """Append (idempotently replacing any prior block with the same section header) an
    assumptions block to data/calibration.md, so every generator documents its own
    knobs next to the standard/source that justifies them."""
    marker_start = f"<!-- section:{section}:start -->"
    marker_end = f"<!-- section:{section}:end -->"
    block = "\n".join([f"## {section}", marker_start, *lines, marker_end, ""])

    if not CALIBRATION_PATH.exists():
        CALIBRATION_PATH.write_text(
            "# calibration.md — documented assumptions behind the synthetic data\n\n"
            "Every generator appends its own section here when run. See CLAUDE.md section 5\n"
            "for the standards each assumption is grounded in.\n\n",
            encoding="utf-8",
        )

    text = CALIBRATION_PATH.read_text(encoding="utf-8")
    start_idx = text.find(marker_start)
    if start_idx == -1:
        text = text.rstrip("\n") + "\n\n" + block
    else:
        header_idx = text.rfind("## ", 0, start_idx)
        end_idx = text.find(marker_end)
        end_idx = text.find("\n", end_idx) + 1
        text = text[:header_idx] + block + text[end_idx:]

    CALIBRATION_PATH.write_text(text, encoding="utf-8")
