from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class TrainingAssignment(Base):
    __tablename__ = "training_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.operator_id"))
    scenario: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(String(256))
    event_json: Mapped[str | None] = mapped_column(String, nullable=True)  # for NearMissReplay
    status: Mapped[str] = mapped_column(String(16), default="assigned")  # assigned/completed
    assigned_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=dt.datetime.utcnow
    )
    completed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TrainingScore(Base):
    __tablename__ = "training_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.operator_id"))
    scenario: Mapped[str] = mapped_column(String(32))
    cycle_time_s: Mapped[float] = mapped_column(Float)
    smoothness: Mapped[float] = mapped_column(Float)
    fuel_per_cycle_l: Mapped[float] = mapped_column(Float)
    idle_s: Mapped[float] = mapped_column(Float)
    skill_factor_after: Mapped[float] = mapped_column(Float)
    recorded_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=dt.datetime.utcnow
    )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.operator_id"))
    instructor_name: Mapped[str] = mapped_column(String(64))
    slot_start: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    slot_end: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(16), default="requested"
    )  # requested/confirmed/cancelled
    created_offline: Mapped[bool] = mapped_column(default=False)
