from app.rules.live import (
    near_miss_trigger,
    proximity_zones,
    seatbelt_alert,
    zone_for_distance,
)


def test_seatbelt_hard_alert_while_traveling_unfastened() -> None:
    assert (
        seatbelt_alert(
            engine_on=True,
            travel_kmh=8.0,
            swing_rate_dps=0,
            seatbelt_unfastened=True,
            unfastened_duration_s=10,
        )
        == "hard"
    )


def test_seatbelt_soft_reminder_while_idle_unfastened() -> None:
    assert (
        seatbelt_alert(
            engine_on=True,
            travel_kmh=0,
            swing_rate_dps=0,
            seatbelt_unfastened=True,
            unfastened_duration_s=30,
        )
        == "soft"
    )


def test_seatbelt_no_alert_when_fastened() -> None:
    assert (
        seatbelt_alert(
            engine_on=True,
            travel_kmh=8.0,
            swing_rate_dps=0,
            seatbelt_unfastened=False,
            unfastened_duration_s=0,
        )
        is None
    )


def test_seatbelt_no_alert_when_engine_off() -> None:
    assert (
        seatbelt_alert(
            engine_on=False,
            travel_kmh=0,
            swing_rate_dps=0,
            seatbelt_unfastened=True,
            unfastened_duration_s=30,
        )
        is None
    )


def test_proximity_zone_widens_in_poor_conditions() -> None:
    clear = proximity_zones(
        "excavator",
        visibility_m=10000,
        precip_mm=0,
        wind_kmh=5,
        is_swinging=False,
        is_reversing=False,
    )
    poor = proximity_zones(
        "excavator",
        visibility_m=500,
        precip_mm=10,
        wind_kmh=30,
        is_swinging=False,
        is_reversing=False,
    )
    assert poor.amber_m > clear.amber_m
    assert poor.red_m > clear.red_m


def test_proximity_zone_widens_while_swinging() -> None:
    still = proximity_zones(
        "excavator",
        visibility_m=10000,
        precip_mm=0,
        wind_kmh=5,
        is_swinging=False,
        is_reversing=False,
    )
    swinging = proximity_zones(
        "excavator",
        visibility_m=10000,
        precip_mm=0,
        wind_kmh=5,
        is_swinging=True,
        is_reversing=False,
    )
    assert swinging.amber_m > still.amber_m


def test_zone_for_distance() -> None:
    zones = proximity_zones(
        "excavator",
        visibility_m=10000,
        precip_mm=0,
        wind_kmh=5,
        is_swinging=False,
        is_reversing=False,
    )
    assert zone_for_distance(1.0, zones) == "red"
    assert zone_for_distance(zones.amber_m + 5, zones) == "green"


def test_near_miss_red_zone_during_swing() -> None:
    assert (
        near_miss_trigger(
            "red", is_swinging=True, is_reversing=False, seatbelt_unfastened=False, travel_kmh=0
        )
        == "red_zone_swing"
    )


def test_near_miss_belt_off_travel() -> None:
    assert (
        near_miss_trigger(
            "green", is_swinging=False, is_reversing=False, seatbelt_unfastened=True, travel_kmh=8.0
        )
        == "belt_off_travel"
    )


def test_near_miss_none_when_safe() -> None:
    assert (
        near_miss_trigger(
            "green", is_swinging=False, is_reversing=False, seatbelt_unfastened=False, travel_kmh=0
        )
        is None
    )
