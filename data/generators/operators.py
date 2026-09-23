"""Generate operators.csv — CLAUDE.md section 5.1.

OP1001 is fixed (referenced verbatim by telemetry_seed.csv) as a `belt_skipper` persona,
consistent with the seed's 10:00/09:00 unfastened-belt + high-idle rows and the demo
narrative arc in CLAUDE.md section 2.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from common import GENERATED_DIR, append_calibration_note, ensure_dirs, get_rng, load_config

SKILLS = ["Beginner", "Intermediate", "Expert"]
SKILL_WEIGHTS = [0.30, 0.45, 0.25]
LANGUAGES = ["en", "hi", "ta"]
LANGUAGE_WEIGHTS = [0.35, 0.40, 0.25]
CONTROL_PATTERNS = ["ISO", "SAE"]


def _years_exp_for_skill(rng: np.random.Generator, skill: str) -> float:
    ranges = {"Beginner": (0, 2), "Intermediate": (2, 7), "Expert": (7, 22)}
    return round(rng.uniform(*ranges[skill]), 1)


def generate(config: dict) -> pd.DataFrame:
    rng = get_rng(config, "operators")
    n = config["fleet"]["num_operators"]
    persona_mix = config["personas"]["mix"]
    personas = list(persona_mix.keys())
    persona_weights = list(persona_mix.values())

    rows = []
    for i in range(1, n + 1):
        operator_id = f"OP{1000 + i}"
        is_seed_operator = operator_id == "OP1001"

        skill = "Intermediate" if is_seed_operator else rng.choice(SKILLS, p=SKILL_WEIGHTS)
        persona = "belt_skipper" if is_seed_operator else rng.choice(personas, p=persona_weights)
        years_exp = 4.5 if is_seed_operator else _years_exp_for_skill(rng, skill)
        certification_level = "Standard" if skill != "Expert" else "Advanced"
        training_completion_pct = round(rng.uniform(20, 100), 0)
        ghost_skill_factor = {
            "Beginner": rng.uniform(0.35, 0.55),
            "Intermediate": rng.uniform(0.55, 0.80),
            "Expert": rng.uniform(0.85, 0.98),
        }[skill]

        rows.append(
            {
                "operator_id": operator_id,
                "skill": skill,
                "years_exp": years_exp,
                "persona": persona,
                "language": rng.choice(LANGUAGES, p=LANGUAGE_WEIGHTS),
                "shift": "night" if rng.random() < 0.2 else "day",
                "shift_number": int(rng.integers(1, 3)),
                "certification_level": certification_level,
                "certification_expiry_days": int(rng.uniform(30, 720)),
                "hours_on_this_machine_model": int(rng.uniform(50, 6000)),
                "hours_total_career": int(years_exp * rng.uniform(1400, 2000)),
                "preferred_control_pattern": rng.choice(CONTROL_PATTERNS),
                "incident_history_count": int(rng.poisson(0.3 if skill == "Expert" else 0.8)),
                "training_completion_pct": training_completion_pct,
                "ghost_skill_factor": round(float(ghost_skill_factor), 3),
            }
        )

    return pd.DataFrame(rows)


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    df = generate(config)
    out_path = GENERATED_DIR / "operators.csv"
    df.to_csv(out_path, index=False)
    print(f"[operators] wrote {len(df)} rows -> {out_path}")

    append_calibration_note(
        "Operators (operators.csv)",
        [
            "- Skill mix 30/45/25 Beginner/Intermediate/Expert; persona mix from "
            "`data/config.yaml.personas.mix`.",
            "- `ghost_skill_factor` (USP-1) is a synthetic 0-1 proxy for how close an "
            "operator's cycle trace is to the expert ghost — sampled by skill band here, "
            "and intended to move over time as an operator completes Ghost Operator "
            "scenarios (not modeled as a time series in this generator pass).",
            "- OP1001 is pinned to persona=belt_skipper, skill=Intermediate so the seed's "
            "10:00/next-day-09:00 unfastened-belt + high-idle rows read as in-character "
            "rather than anomalous noise.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
