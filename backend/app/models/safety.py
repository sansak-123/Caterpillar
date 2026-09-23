from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), index=True)
    machine_id: Mapped[str] = mapped_column(ForeignKey("machines.machine_id"))
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.operator_id"))
    type: Mapped[str] = mapped_column(String(32))  # seatbelt/proximity/idle
    severity: Mapped[str] = mapped_column(String(16))  # amber/red
    message: Mapped[str] = mapped_column(String(256))
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    ts: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), index=True)
    machine_id: Mapped[str] = mapped_column(ForeignKey("machines.machine_id"))
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.operator_id"))
    type: Mapped[str] = mapped_column(String(32))  # struck_by/caught_between/rollover
    severity: Mapped[str] = mapped_column(String(16))  # Near-miss/Minor/Moderate/Severe
    is_near_miss: Mapped[bool] = mapped_column(Boolean, default=True)
    trigger: Mapped[str] = mapped_column(String(32))
    root_cause_category: Mapped[str | None] = mapped_column(String(256), nullable=True)
    corrective_action: Mapped[str | None] = mapped_column(String(256), nullable=True)
    context_json: Mapped[str | None] = mapped_column(String, nullable=True)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IdleTag(Base):
    __tablename__ = "idle_tags"

    window_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    machine_id: Mapped[str] = mapped_column(ForeignKey("machines.machine_id"))
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.operator_id"))
    ts_start: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    ts_end: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    duration_min: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(16))  # truck_wait/warmup/break/unjustified
