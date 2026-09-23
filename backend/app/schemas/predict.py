from __future__ import annotations

from pydantic import BaseModel


class TaskTimePredictRequest(BaseModel):
    est_min: float
    task_type: str
    operator_skill: str | None = None
    weather: str | None = None
    soil_type: str | None = None
    material_type: str | None = None
    machine_age_yrs: float | None = None
    hours_since_last_service: float | None = None
    precip_mm: float | None = None
    wind_kmh: float | None = None
    visibility_m: float | None = None
    temp_c: float | None = None
    humidity_pct: float | None = None
    dig_depth_m: float | None = None
    haul_distance_m: float | None = None
    hour_of_day: int | None = None
    day_of_week: int | None = None
    planned_volume_m3: float | None = None
    truck_wait_min: float | None = None
    number_of_trucks: int | None = None
    task_sequence_number_in_shift: int | None = None
    number_of_nearby_workers: int | None = None
    site_congestion_index_at_start: float | None = None
    operator_fatigue_score_at_start: float | None = None
    previous_task_overrun_ratio: float | None = None
    is_holiday: bool = False
    ppe_compliance_flag: bool = True
    pre_start_checklist_completed: bool = True
    measured_skill_score: float | None = None
    operator_idle_ratio_7d: float | None = None


class PredictionResponse(BaseModel):
    value: float
    range: list[float]
    reasons: list[str]
