"""Real-time, per-minute safety rules — CLAUDE.md section 6. Pure functions; this is
the Python mirror of the on-device TS safety engine (Phase 5), so both sides can be
tested against the same fixtures and must never disagree on a red alert.
"""

from __future__ import annotations

from dataclasses import dataclass

BASE_RADIUS_M = {
    "excavator": 12.0,
    "wheel_loader": 10.0,
    "dozer": 14.0,
}


def seatbelt_alert(
    engine_on: bool,
    travel_kmh: float,
    swing_rate_dps: float,
    seatbelt_unfastened: bool,
    unfastened_duration_s: float,
) -> str | None:
    """'hard' = full alert (moving/swinging, unfastened > 5s). 'soft' = reminder while
    idle with engine on and unfastened. None otherwise."""
    if not engine_on:
        return None
    moving_or_swinging = travel_kmh > 0.5 or swing_rate_dps > 5
    if seatbelt_unfastened and moving_or_swinging and unfastened_duration_s > 5:
        return "hard"
    if seatbelt_unfastened and not moving_or_swinging:
        return "soft"
    return None


def condition_factor(visibility_m: float | None, precip_mm: float, wind_kmh: float) -> float:
    """Proximity radii widen as conditions worsen — CLAUDE.md USP-4."""
    factor = 1.0
    if visibility_m is not None:
        factor *= 1 + max(0.0, (1000 - visibility_m) / 2000)
    factor *= 1 + precip_mm / 50
    factor *= 1 + wind_kmh / 100
    return factor


@dataclass(frozen=True)
class ProximityZones:
    red_m: float
    amber_m: float


def proximity_zones(
    machine_class: str,
    visibility_m: float | None,
    precip_mm: float,
    wind_kmh: float,
    is_swinging: bool,
    is_reversing: bool,
    is_rear_sector: bool = False,
) -> ProximityZones:
    base = BASE_RADIUS_M.get(machine_class, 10.0)
    cond = condition_factor(visibility_m, precip_mm, wind_kmh)
    state = 1.3 if (is_swinging or is_reversing) else 1.0
    rear = 1.5 if is_rear_sector else 1.0  # rear blind spot weighted higher, ISO 5006
    amber = base * cond * state * rear
    red = amber * 0.4
    return ProximityZones(red_m=red, amber_m=amber)


def zone_for_distance(distance_m: float, zones: ProximityZones) -> str:
    if distance_m < zones.red_m:
        return "red"
    if distance_m < zones.amber_m:
        return "amber"
    return "green"


def near_miss_trigger(
    zone: str,
    is_swinging: bool,
    is_reversing: bool,
    seatbelt_unfastened: bool,
    travel_kmh: float,
    hard_stop_within_2s_of_alert: bool = False,
) -> str | None:
    """CLAUDE.md section 6 `near_miss`: red-zone entry during swing/reverse, belt-off
    travel, or a hard stop shortly after a proximity alert."""
    if zone == "red" and is_swinging:
        return "red_zone_swing"
    if zone == "red" and is_reversing:
        return "red_zone_reverse"
    if seatbelt_unfastened and travel_kmh > 0.5:
        return "belt_off_travel"
    if hard_stop_within_2s_of_alert:
        return "hard_stop_after_alert"
    return None
