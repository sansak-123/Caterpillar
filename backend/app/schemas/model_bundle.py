from __future__ import annotations

from pydantic import BaseModel


class ModelBundleRegisterRequest(BaseModel):
    version: str
    task_time_p50_uri: str
    task_time_p90_uri: str
    thresholds_json: str
    feature_schema_json: str
