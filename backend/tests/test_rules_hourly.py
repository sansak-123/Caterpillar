import csv
from pathlib import Path

import pytest

from app.rules.hourly import evaluate_reading, interval_minutes

SEED_PATH = Path(__file__).resolve().parents[2] / "data" / "seed" / "telemetry_seed.csv"


def _load_seed_rows() -> list[dict]:
    with open(SEED_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_seed_file_has_the_four_expected_rows() -> None:
    rows = _load_seed_rows()
    assert len(rows) == 4
    assert [r["timestamp"] for r in rows] == [
        "2025-05-01 08:00:00",
        "2025-05-01 10:00:00",
        "2025-05-01 14:00:00",
        "2025-05-02 09:00:00",
    ]


def test_1000_row_triggers_seatbelt_and_idle_alert() -> None:
    rows = _load_seed_rows()
    row_0800, row_1000 = rows[0], rows[1]
    interval = interval_minutes(float(row_1000["engine_hours"]), float(row_0800["engine_hours"]))

    result = evaluate_reading(
        idle_min=float(row_1000["idle_min"]),
        seatbelt_status=row_1000["seatbelt_status"],
        interval_min=interval,
    )

    assert interval == pytest.approx(78.0)  # 1524.8 - 1523.5 = 1.3h
    assert result.idle_alert is True
    assert result.seatbelt_alert is True
    assert result.safety_alert is True
    assert row_1000["safety_alert"] == "Yes"


def test_0800_row_does_not_trigger() -> None:
    rows = _load_seed_rows()
    row_0800 = rows[0]
    # first reading in the fixture — no prior engine_hours, falls back to the absolute threshold
    result = evaluate_reading(
        idle_min=float(row_0800["idle_min"]),
        seatbelt_status=row_0800["seatbelt_status"],
        interval_min=None,
    )

    assert result.idle_alert is False
    assert result.seatbelt_alert is False
    assert result.safety_alert is False
    assert row_0800["safety_alert"] == "No"


def test_1400_row_does_not_trigger() -> None:
    rows = _load_seed_rows()
    row_1000, row_1400 = rows[1], rows[2]
    interval = interval_minutes(float(row_1400["engine_hours"]), float(row_1000["engine_hours"]))

    result = evaluate_reading(
        idle_min=float(row_1400["idle_min"]),
        seatbelt_status=row_1400["seatbelt_status"],
        interval_min=interval,
    )

    assert result.idle_alert is False
    assert result.seatbelt_alert is False
    assert result.safety_alert is False
    assert row_1400["safety_alert"] == "No"


def test_next_day_row_triggers_via_seatbelt_even_though_idle_ratio_is_lower() -> None:
    rows = _load_seed_rows()
    row_1400, row_next = rows[2], rows[3]
    interval = interval_minutes(float(row_next["engine_hours"]), float(row_1400["engine_hours"]))

    result = evaluate_reading(
        idle_min=float(row_next["idle_min"]),
        seatbelt_status=row_next["seatbelt_status"],
        interval_min=interval,
    )

    assert result.seatbelt_alert is True
    assert result.safety_alert is True
    assert row_next["safety_alert"] == "Yes"
