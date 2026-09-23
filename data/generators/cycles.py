"""Generate cycle_traces.parquet — CLAUDE.md section 5.1.

Parametric excavator dig cycles (dig -> swing_load -> dump -> swing_return) as joint
angle time series, sampled at 1 Hz. Experts: shorter, smoother, consistent. Beginners:
longer, jerkier, more pauses. Duration bands are a documented assumption referencing the
CAT Performance Handbook's cycle-time methodology (no public per-second curves exist to
fit against).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from common import GENERATED_DIR, append_calibration_note, ensure_dirs, get_rng, load_config

PHASES = ["dig", "swing_load", "dump", "swing_return"]

# (mean_seconds, std_seconds, noise_amplitude_deg, pause_prob) per skill band
SKILL_PROFILE = {
    "Expert": {"phase_secs": (3.5, 0.6), "noise_deg": 1.0, "pause_prob": 0.02},
    "Intermediate": {"phase_secs": (5.0, 1.2), "noise_deg": 2.5, "pause_prob": 0.08},
    "Beginner": {"phase_secs": (7.5, 2.2), "noise_deg": 5.0, "pause_prob": 0.18},
}

# (boom_start, boom_end, stick_start, stick_end, bucket_start, bucket_end, swing_start, swing_end)
PHASE_TARGETS = {
    "dig": (25, 10, 20, 90, 20, 70, 0, 0),
    "swing_load": (10, 15, 90, 95, 70, 72, 0, 75),
    "dump": (15, 30, 95, 60, 72, 20, 75, 75),
    "swing_return": (30, 25, 60, 20, 20, 20, 75, 0),
}


def _ease(x: np.ndarray) -> np.ndarray:
    return x * x * (3 - 2 * x)  # smoothstep


def _simulate_cycle(cycle_id: str, operator_id: str, skill: str, rng: np.random.Generator) -> pd.DataFrame:
    profile = SKILL_PROFILE[skill]
    rows = []
    t = 0.0
    bucket_capacity_fill = rng.uniform(0.6, 1.0)
    peak_pressure = rng.uniform(180, 260)

    for phase in PHASES:
        secs = max(1.5, rng.normal(*profile["phase_secs"]))
        n = max(2, int(round(secs)))
        boom0, boom1, stick0, stick1, bucket0, bucket1, swing0, swing1 = PHASE_TARGETS[phase]

        frac = _ease(np.linspace(0, 1, n))
        noise = rng.normal(0, profile["noise_deg"], n)

        if rng.random() < profile["pause_prob"]:
            pause_at = rng.integers(1, max(2, n - 1))
            frac = np.insert(frac, pause_at, frac[pause_at])
            noise = np.insert(noise, pause_at, rng.normal(0, profile["noise_deg"]))
            n += 1

        boom_deg = boom0 + (boom1 - boom0) * frac + noise
        stick_deg = stick0 + (stick1 - stick0) * frac + noise
        bucket_deg = bucket0 + (bucket1 - bucket0) * frac + noise
        swing_deg = swing0 + (swing1 - swing0) * frac + noise * 0.5

        is_dig = phase == "dig"
        is_load_phase = phase in ("dig", "swing_load")
        hydraulic_pressure_bar = np.where(
            is_dig, peak_pressure * frac + rng.normal(0, 8, n), rng.normal(40, 10, n)
        ).clip(min=0)
        payload_kg = np.where(is_load_phase, bucket_capacity_fill * 1800 * np.clip(frac, 0, 1), 0.0)
        fuel_burn_l = np.full(n, secs / n * 0.06)  # ~3.6 L/min work-rate equivalent

        for i in range(n):
            rows.append(
                {
                    "cycle_id": cycle_id,
                    "operator_id": operator_id,
                    "skill": skill,
                    "t": round(t, 1),
                    "phase": phase,
                    "boom_deg": round(float(boom_deg[i]), 1),
                    "stick_deg": round(float(stick_deg[i]), 1),
                    "bucket_deg": round(float(bucket_deg[i]), 1),
                    "swing_deg": round(float(swing_deg[i]), 1),
                    "hydraulic_pressure_bar": round(float(hydraulic_pressure_bar[i]), 1),
                    "payload_kg": round(float(payload_kg[i]), 0),
                    "fuel_burn_l": round(float(fuel_burn_l[i]), 4),
                }
            )
            t += 1.0

    return pd.DataFrame(rows)


def generate(config: dict) -> pd.DataFrame:
    rng = get_rng(config, "cycles")
    operators = pd.read_csv(GENERATED_DIR / "operators.csv")
    n_cycles = config["cycles"]["count"]

    frames = []
    for i in range(n_cycles):
        operator = operators.sample(random_state=int(rng.integers(0, 2**31))).iloc[0]
        cycle_id = f"CYC{i + 1:05d}"
        frames.append(_simulate_cycle(cycle_id, operator["operator_id"], operator["skill"], rng))

    return pd.concat(frames, ignore_index=True)


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    if not (GENERATED_DIR / "operators.csv").exists():
        raise SystemExit("Run operators.py first.")

    df = generate(config)
    out_path = GENERATED_DIR / "cycle_traces.parquet"
    df.to_parquet(out_path, index=False)
    n_cycles = df["cycle_id"].nunique()
    print(f"[cycles] wrote {n_cycles} cycles ({len(df)} rows) -> {out_path}")

    append_calibration_note(
        "Cycle traces (cycle_traces.parquet)",
        [
            "- Per-phase duration bands (Expert ~3.5s, Intermediate ~5.0s, Beginner "
            "~7.5s mean per phase) are an assumption inspired by the CAT Performance "
            "Handbook's cycle-time framing, not fit to a public per-second dataset — no "
            "such public dataset exists.",
            "- Smoothness (jerk proxy) is `noise_deg` added on top of a smoothstep "
            "interpolation between phase-target joint angles; beginners also get a "
            "chance of an inserted pause frame per phase.",
            "- USP-1 Ghost Operator: GhostPlayer.cs (Phase 7) replays an expert cycle "
            "trace next to a trainee; Scoring.cs compares cycle time/smoothness/fuel "
            "against it.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
