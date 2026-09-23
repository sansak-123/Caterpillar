from __future__ import annotations

from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str  # operator/supervisor/trainer
    operator_id: str | None = None
    language: str = "en"


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    operator_id: str | None = None


class DeviceRegisterRequest(BaseModel):
    pass


class DeviceRegisterResponse(BaseModel):
    device_id: str
    device_token: str
