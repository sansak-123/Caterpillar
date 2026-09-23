from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Task(Base):
    """Server-authoritative task record. `version` backs the offline conflict rule in
    CLAUDE.md section 3.1: an operator's offline status change is kept, but if the
    server's version has moved since the device last saw it, the row is flagged
    `conflict=True` for supervisor review instead of being silently overwritten."""

    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.operator_id"), index=True)
    machine_id: Mapped[str] = mapped_column(ForeignKey("machines.machine_id"), index=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.site_id"))

    task_type: Mapped[str] = mapped_column(String(32))
    scheduled_date: Mapped[dt.date] = mapped_column(index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/in_progress/done

    est_min: Mapped[float] = mapped_column(Float)
    p50_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    p90_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_min: Mapped[float | None] = mapped_column(Float, nullable=True)

    weather_condition: Mapped[str | None] = mapped_column(String(16), nullable=True)
    risk_band: Mapped[str | None] = mapped_column(String(16), nullable=True)  # safe/caution/danger

    version: Mapped[int] = mapped_column(Integer, default=1)
    conflict: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=dt.datetime.utcnow
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow
    )
