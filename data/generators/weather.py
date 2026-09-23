"""Generate weather_hourly.csv — CLAUDE.md section 5.1.

Synthetic hourly weather per site with realistic persistence (a Markov "wet" state so
rain arrives in multi-hour/day spells rather than independently per hour) and a
monsoon-like wet season concentrated in a contiguous window per site.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from common import (
    GENERATED_DIR,
    append_calibration_note,
    date_range,
    ensure_dirs,
    get_rng,
    load_config,
)

CLIMATE_PARAMS = {
    # (temp baseline C, temp seasonal amplitude, monsoon wet-day probability, dry wet-day prob)
    "tropical_monsoon": {"temp_base": 29, "temp_amp": 4, "p_wet_monsoon": 0.55, "p_wet_dry": 0.04},
    "semi_arid": {"temp_base": 31, "temp_amp": 7, "p_wet_monsoon": 0.30, "p_wet_dry": 0.02},
    "coastal_humid": {"temp_base": 30, "temp_amp": 3, "p_wet_monsoon": 0.45, "p_wet_dry": 0.06},
}

STAY_WET = 0.80  # P(still wet next hour | wet) — gives multi-hour rain spells
STAY_DRY_IN_MONSOON = 0.90  # P(still dry next hour | dry, in monsoon window)
STAY_DRY_OUTSIDE = 0.985


def _monsoon_window(days: list[dt.date], rng: np.random.Generator) -> tuple[int, int]:
    n = len(days)
    length = int(n * rng.uniform(0.30, 0.40))
    start = int(rng.uniform(0.15, 0.45) * n)
    return start, min(start + length, n)


def _simulate_site(site_id: str, climate: str, days: list[dt.date], rng: np.random.Generator) -> pd.DataFrame:
    params = CLIMATE_PARAMS[climate]
    n_days = len(days)
    n_hours = n_days * 24
    mon_start, mon_end = _monsoon_window(days, rng)

    wet = np.zeros(n_hours, dtype=bool)
    in_monsoon = np.zeros(n_hours, dtype=bool)
    for h in range(n_hours):
        day_idx = h // 24
        in_monsoon[h] = mon_start <= day_idx < mon_end
        p_wet_enter = params["p_wet_monsoon"] if in_monsoon[h] else params["p_wet_dry"]
        if h == 0:
            wet[h] = rng.random() < p_wet_enter
            continue
        if wet[h - 1]:
            wet[h] = rng.random() < STAY_WET
        else:
            stay_dry = STAY_DRY_IN_MONSOON if in_monsoon[h] else STAY_DRY_OUTSIDE
            wet[h] = rng.random() >= stay_dry

    hours_of_day = np.arange(n_hours) % 24
    day_of_year = np.array([d.timetuple().tm_yday for d in days for _ in range(24)])

    seasonal = params["temp_amp"] * np.sin(2 * np.pi * (day_of_year - 80) / 365)
    diurnal = 4.5 * np.sin(2 * np.pi * (hours_of_day - 9) / 24)
    temp_noise = rng.normal(0, 1.0, n_hours)
    temp_c = params["temp_base"] + seasonal + diurnal + temp_noise - np.where(wet, 3.0, 0.0)

    precip_mm = np.where(wet, rng.gamma(shape=1.5, scale=3.0, size=n_hours), 0.0)
    precip_mm = np.round(precip_mm, 1)

    # wind: mean-reverting random walk, with gustier conditions during wet spells
    wind_kmh = np.empty(n_hours)
    wind_kmh[0] = 12.0
    wind_innovations = rng.normal(0, 2.0, n_hours)
    for h in range(1, n_hours):
        target = 22.0 if wet[h] else 10.0
        wind_kmh[h] = wind_kmh[h - 1] + 0.15 * (target - wind_kmh[h - 1]) + wind_innovations[h]
    wind_kmh = np.clip(wind_kmh, 0, None).round(1)

    humidity_pct = np.clip(55 + np.where(wet, 30, 0) + rng.normal(0, 5, n_hours), 20, 100).round(0)
    barometric_pressure_hpa = np.clip(
        1011 - np.where(wet, 6, 0) + rng.normal(0, 1.5, n_hours), 985, 1025
    ).round(1)
    uv_index = np.clip(
        np.where(
            (hours_of_day >= 6) & (hours_of_day <= 18),
            (8 * np.sin(np.pi * (hours_of_day - 6) / 12)) * np.where(wet, 0.25, 1.0),
            0,
        )
        + rng.normal(0, 0.3, n_hours),
        0,
        11,
    ).round(1)
    dust_index = np.clip(
        np.where(wet, 5, 35) + np.where(climate == "semi_arid", 15, 0) + rng.normal(0, 8, n_hours),
        0,
        100,
    ).round(0)

    # visibility drops with heavy rain and, separately, with dust
    visibility_m = np.clip(
        10000 - precip_mm * 350 - dust_index * 40 + rng.normal(0, 300, n_hours), 200, 10000
    ).round(0)

    ground_moisture_pct = np.empty(n_hours)
    ground_moisture_pct[0] = 25.0
    for h in range(1, n_hours):
        decay = ground_moisture_pct[h - 1] * 0.985
        ground_moisture_pct[h] = min(100.0, decay + precip_mm[h] * 1.2)
    ground_moisture_pct = ground_moisture_pct.round(1)

    freeze_thaw_flag = temp_c < 2.0
    daylight_flag = (hours_of_day >= 6) & (hours_of_day <= 18)

    condition = np.where(
        precip_mm > 0.5,
        "Rainy",
        np.where(wind_kmh > 25, "Windy", np.where(humidity_pct > 75, "Cloudy", "Sunny")),
    )

    monsoon_phase = np.where(
        in_monsoon, "monsoon", np.where(np.arange(n_hours) // 24 < mon_start, "pre_monsoon", "post_monsoon")
    )

    ts = pd.date_range(
        start=dt.datetime.combine(days[0], dt.time.min), periods=n_hours, freq="h"
    )

    return pd.DataFrame(
        {
            "ts": ts,
            "site_id": site_id,
            "temp_c": temp_c.round(1),
            "precip_mm": precip_mm,
            "wind_kmh": wind_kmh,
            "visibility_m": visibility_m,
            "humidity_pct": humidity_pct,
            "barometric_pressure_hpa": barometric_pressure_hpa,
            "uv_index": uv_index,
            "dust_index": dust_index,
            "ground_moisture_pct": ground_moisture_pct,
            "freeze_thaw_flag": freeze_thaw_flag,
            "daylight_flag": daylight_flag,
            "condition": condition,
            "monsoon_phase": monsoon_phase,
        }
    )


def generate(config: dict) -> pd.DataFrame:
    sites_df = pd.read_csv(GENERATED_DIR / "sites.csv")
    days = date_range(config)
    frames = []
    for _, site in sites_df.iterrows():
        rng = get_rng(config, f"weather:{site['site_id']}")
        frames.append(_simulate_site(site["site_id"], site["climate_profile"], days, rng))
    return pd.concat(frames, ignore_index=True)


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    if not (GENERATED_DIR / "sites.csv").exists():
        raise SystemExit("Run sites.py before weather.py (needs generated/sites.csv).")

    df = generate(config)
    out_path = GENERATED_DIR / "weather_hourly.csv"
    df.to_csv(out_path, index=False)
    print(f"[weather] wrote {len(df)} rows -> {out_path}")

    append_calibration_note(
        "Weather (weather_hourly.csv)",
        [
            "- Rain persistence modeled as a 2-state Markov chain per site (P(stay wet)="
            f"{STAY_WET}), so spells last multiple hours instead of hour-to-hour "
            "independence — a documented simplification, not fit to real station data.",
            "- Each site gets its own contiguous monsoon window (~30-40% of the 90-day "
            "run) with an elevated hourly wet-transition probability, loosely standing in "
            "for the Indian monsoon season referenced in CLAUDE.md section 5.",
            "- `condition` (Sunny/Cloudy/Rainy/Windy) is derived from the continuous "
            "columns with fixed thresholds (precip>0.5mm -> Rainy, wind>25km/h -> Windy, "
            "humidity>75% -> Cloudy, else Sunny) to match the categorical values used in "
            "tasks_seed.csv.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
