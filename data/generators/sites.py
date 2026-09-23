"""Generate sites.csv — CLAUDE.md section 5.1."""

from __future__ import annotations

import pandas as pd

from common import GENERATED_DIR, append_calibration_note, ensure_dirs, get_rng, load_config

SITES = [
    {
        "site_id": "SITE01",
        "name": "Riverside Metro Expansion",
        "lat": 19.0760,
        "lon": 72.8777,
        "terrain_type": "flat_urban",
        "soil_type": "clay",
        "climate_profile": "tropical_monsoon",
    },
    {
        "site_id": "SITE02",
        "name": "Highway 44 Cutting",
        "lat": 17.3850,
        "lon": 78.4867,
        "terrain_type": "rolling_hills",
        "soil_type": "laterite",
        "climate_profile": "semi_arid",
    },
    {
        "site_id": "SITE03",
        "name": "Coastal Logistics Yard",
        "lat": 13.0827,
        "lon": 80.2707,
        "terrain_type": "flat_coastal",
        "soil_type": "sandy_loam",
        "climate_profile": "coastal_humid",
    },
]

SOIL_BEARING_KPA = {"clay": 100, "laterite": 180, "sandy_loam": 140}


def generate(config: dict) -> pd.DataFrame:
    rng = get_rng(config, "sites")
    rows = []
    for site in SITES:
        rows.append(
            {
                **site,
                "elevation_m": int(rng.uniform(5, 550)),
                "soil_bearing_capacity": SOIL_BEARING_KPA[site["soil_type"]],
                "site_area_hectares": round(rng.uniform(8, 60), 1),
                "timezone": "Asia/Kolkata",
            }
        )
    return pd.DataFrame(rows)


def main() -> pd.DataFrame:
    ensure_dirs()
    config = load_config()
    df = generate(config)
    out_path = GENERATED_DIR / "sites.csv"
    df.to_csv(out_path, index=False)
    print(f"[sites] wrote {len(df)} rows -> {out_path}")

    append_calibration_note(
        "Sites (sites.csv)",
        [
            "- 3 sites across India (matches the en/hi/ta i18n scope), each given a distinct "
            "`climate_profile` so weather.py can vary monsoon intensity and dust/visibility "
            "baselines per site rather than using one national average.",
            "- `soil_bearing_capacity` (kPa) is a coarse per-soil-type constant, not a "
            "geotechnical survey — used only to perturb task time via soil effects.",
        ],
    )
    return df


if __name__ == "__main__":
    main()
