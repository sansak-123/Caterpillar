from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class TelemetryMinute(Base):
    """1-minute aggregate ingested from MQTT (CLAUDE.md section 3.1: raw 1 Hz stays on
    device, only 1-min aggregates are uploaded). (ts, machine_id) is the natural key —
    the Alembic migration turns this into a TimescaleDB hypertable on `ts`."""

    __tablename__ = "telemetry_1min"

    ts: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    machine_id: Mapped[str] = mapped_column(ForeignKey("machines.machine_id"), primary_key=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.operator_id"))
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.site_id"))

    engine_on: Mapped[bool] = mapped_column(Boolean, default=True)
    state: Mapped[str] = mapped_column(String(16))  # work/idle/travel/off
    seatbelt: Mapped[str] = mapped_column(String(16))  # Fastened/Unfastened
    swing_rate_dps: Mapped[float] = mapped_column(Float, default=0)
    travel_kmh: Mapped[float] = mapped_column(Float, default=0)
    reverse: Mapped[bool] = mapped_column(Boolean, default=False)
    fuel_rate_lph: Mapped[float] = mapped_column(Float, default=0)
    nearest_person_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    zone: Mapped[str | None] = mapped_column(String(8), nullable=True)  # green/amber/red


class SyncEvent(Base):
    """Outbox events pushed from the device (CLAUDE.md section 3.1). `event_id` is a
    device-generated uuidv7; the unique constraint is what makes /sync/push idempotent —
    pushing the same batch twice is a no-op upsert, not a duplicate insert."""

    __tablename__ = "sync_events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True)
    type: Mapped[str] = mapped_column(String(32))
    payload_json: Mapped[str] = mapped_column(String)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=dt.datetime.utcnow
    )
