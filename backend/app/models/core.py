from __future__ import annotations

from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Machine(Base):
    __tablename__ = "machines"

    machine_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    machine_class: Mapped[str] = mapped_column("class", String(32))
    model_size_t: Mapped[float] = mapped_column(Float)
    age_yrs: Mapped[int] = mapped_column(Integer)
    blind_spot_profile: Mapped[str] = mapped_column(String(64))
    gps_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    idle_lph: Mapped[float] = mapped_column(Float)
    work_lph: Mapped[float] = mapped_column(Float)
    service_interval_hrs: Mapped[int] = mapped_column(Integer)
    hours_since_last_service: Mapped[float] = mapped_column(Float)


class Operator(Base):
    __tablename__ = "operators"

    operator_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    skill: Mapped[str] = mapped_column(String(16))
    persona: Mapped[str] = mapped_column(String(32))
    language: Mapped[str] = mapped_column(String(4), default="en")
    shift: Mapped[str] = mapped_column(String(8), default="day")
    ghost_skill_factor: Mapped[float] = mapped_column(Float, default=0.5)


class Site(Base):
    __tablename__ = "sites"

    site_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    soil_type: Mapped[str] = mapped_column(String(32))
    climate_profile: Mapped[str] = mapped_column(String(32))
    timezone: Mapped[str] = mapped_column(String(32), default="UTC")
