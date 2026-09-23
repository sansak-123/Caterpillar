from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

ROLES = ("operator", "supervisor", "trainer")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(16))  # operator/supervisor/trainer
    operator_id: Mapped[str | None] = mapped_column(
        ForeignKey("operators.operator_id"), nullable=True
    )  # set when role=operator
    language: Mapped[str] = mapped_column(String(4), default="en")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=dt.datetime.utcnow
    )


class Device(Base):
    """CLAUDE.md section 3.2: device registered on first login; sync calls are signed
    with this device's token."""

    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    device_token: Mapped[str] = mapped_column(String(128), unique=True)
    registered_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=dt.datetime.utcnow
    )
    last_seen_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ModelBundle(Base):
    """Versioned ONNX bundle metadata (CLAUDE.md section 3.1) — the actual .onnx files
    live in object storage / the filesystem; this row is what /sync/pull advertises and
    what the device downloads via expo-file-system."""

    __tablename__ = "model_bundles"

    version: Mapped[str] = mapped_column(String(32), primary_key=True)
    task_time_p50_uri: Mapped[str] = mapped_column(String(256))
    task_time_p90_uri: Mapped[str] = mapped_column(String(256))
    thresholds_json: Mapped[str] = mapped_column(String)
    feature_schema_json: Mapped[str] = mapped_column(String)
    published_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=dt.datetime.utcnow
    )
