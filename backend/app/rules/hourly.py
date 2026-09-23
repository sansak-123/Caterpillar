"""Hourly-reading safety/idle rule — evaluates a telemetry_seed.csv-shaped reading
(idle_min, seatbelt_status, and the engine-hours delta since the machine's previous
reading). This is what CLAUDE.md section 1's "known insight" is actually describing:
idle_min is idle minutes *within the interval since the previous reading* (engine_hours
delta), not a fixed clock-hour — the 2025-05-01 10:00 seed row's ~70% idle figure only
comes out right when you divide by the 78-minute engine-hours delta, not by 60.
"""

from __future__ import annotations

from dataclasses import dataclass

IDLE_RATIO_THRESHOLD = 0.60
IDLE_MIN_FALLBACK_THRESHOLD = 45  # used when no previous reading exists to derive an interval


@dataclass(frozen=True)
class ReadingAlert:
    idle_alert: bool
    seatbelt_alert: bool

    @property
    def safety_alert(self) -> bool:
        return self.idle_alert or self.seatbelt_alert


def idle_alert(idle_min: float, interval_min: float | None) -> bool:
    if interval_min and interval_min > 0:
        return (idle_min / interval_min) >= IDLE_RATIO_THRESHOLD
    return idle_min >= IDLE_MIN_FALLBACK_THRESHOLD


def seatbelt_alert(seatbelt_status: str) -> bool:
    return seatbelt_status == "Unfastened"


def evaluate_reading(
    idle_min: float, seatbelt_status: str, interval_min: float | None
) -> ReadingAlert:
    return ReadingAlert(
        idle_alert=idle_alert(idle_min, interval_min),
        seatbelt_alert=seatbelt_alert(seatbelt_status),
    )


def interval_minutes(engine_hours: float, previous_engine_hours: float | None) -> float | None:
    if previous_engine_hours is None:
        return None
    return (engine_hours - previous_engine_hours) * 60
