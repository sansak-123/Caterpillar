"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2025-01-01 00:00:00

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "machines",
        sa.Column("machine_id", sa.String(16), primary_key=True),
        sa.Column("class", sa.String(32), nullable=False),
        sa.Column("model_size_t", sa.Float, nullable=False),
        sa.Column("age_yrs", sa.Integer, nullable=False),
        sa.Column("blind_spot_profile", sa.String(64), nullable=False),
        sa.Column("gps_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("idle_lph", sa.Float, nullable=False),
        sa.Column("work_lph", sa.Float, nullable=False),
        sa.Column("service_interval_hrs", sa.Integer, nullable=False),
        sa.Column("hours_since_last_service", sa.Float, nullable=False),
    )

    op.create_table(
        "operators",
        sa.Column("operator_id", sa.String(16), primary_key=True),
        sa.Column("skill", sa.String(16), nullable=False),
        sa.Column("persona", sa.String(32), nullable=False),
        sa.Column("language", sa.String(4), nullable=False, server_default="en"),
        sa.Column("shift", sa.String(8), nullable=False, server_default="day"),
        sa.Column("ghost_skill_factor", sa.Float, nullable=False, server_default="0.5"),
    )

    op.create_table(
        "sites",
        sa.Column("site_id", sa.String(16), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lon", sa.Float, nullable=False),
        sa.Column("soil_type", sa.String(32), nullable=False),
        sa.Column("climate_profile", sa.String(32), nullable=False),
        sa.Column("timezone", sa.String(32), nullable=False, server_default="UTC"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=True),
        sa.Column("language", sa.String(4), nullable=False, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "devices",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("device_token", sa.String(128), nullable=False, unique=True),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_devices_user_id", "devices", ["user_id"])

    op.create_table(
        "model_bundles",
        sa.Column("version", sa.String(32), primary_key=True),
        sa.Column("task_time_p50_uri", sa.String(256), nullable=False),
        sa.Column("task_time_p90_uri", sa.String(256), nullable=False),
        sa.Column("thresholds_json", sa.Text, nullable=False),
        sa.Column("feature_schema_json", sa.Text, nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("task_id", sa.String(32), nullable=False, unique=True),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=False),
        sa.Column("machine_id", sa.String(16), sa.ForeignKey("machines.machine_id"), nullable=False),
        sa.Column("site_id", sa.String(16), sa.ForeignKey("sites.site_id"), nullable=False),
        sa.Column("task_type", sa.String(32), nullable=False),
        sa.Column("scheduled_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("est_min", sa.Float, nullable=False),
        sa.Column("p50_min", sa.Float, nullable=True),
        sa.Column("p90_min", sa.Float, nullable=True),
        sa.Column("actual_min", sa.Float, nullable=True),
        sa.Column("weather_condition", sa.String(16), nullable=True),
        sa.Column("risk_band", sa.String(16), nullable=True),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("conflict", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tasks_operator_id", "tasks", ["operator_id"])
    op.create_index("ix_tasks_machine_id", "tasks", ["machine_id"])
    op.create_index("ix_tasks_scheduled_date", "tasks", ["scheduled_date"])

    op.create_table(
        "telemetry_1min",
        sa.Column("ts", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("machine_id", sa.String(16), sa.ForeignKey("machines.machine_id"), primary_key=True),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=False),
        sa.Column("site_id", sa.String(16), sa.ForeignKey("sites.site_id"), nullable=False),
        sa.Column("engine_on", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("seatbelt", sa.String(16), nullable=False),
        sa.Column("swing_rate_dps", sa.Float, nullable=False, server_default="0"),
        sa.Column("travel_kmh", sa.Float, nullable=False, server_default="0"),
        sa.Column("reverse", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("fuel_rate_lph", sa.Float, nullable=False, server_default="0"),
        sa.Column("nearest_person_m", sa.Float, nullable=True),
        sa.Column("zone", sa.String(8), nullable=True),
    )

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("SELECT create_hypertable('telemetry_1min', 'ts', if_not_exists => TRUE);")

    op.create_table(
        "sync_events",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column("device_id", sa.String(64), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("payload_json", sa.Text, nullable=False),
        sa.Column("attempt", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sync_events_device_id", "sync_events", ["device_id"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("machine_id", sa.String(16), sa.ForeignKey("machines.machine_id"), nullable=False),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("message", sa.String(256), nullable=False),
        sa.Column("acknowledged", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_alerts_ts", "alerts", ["ts"])

    op.create_table(
        "incidents",
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("machine_id", sa.String(16), sa.ForeignKey("machines.machine_id"), nullable=False),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("is_near_miss", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("trigger", sa.String(32), nullable=False),
        sa.Column("root_cause_category", sa.String(256), nullable=True),
        sa.Column("corrective_action", sa.String(256), nullable=True),
        sa.Column("context_json", sa.Text, nullable=True),
        sa.Column("confirmed", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_incidents_ts", "incidents", ["ts"])

    op.create_table(
        "idle_tags",
        sa.Column("window_id", sa.String(16), primary_key=True),
        sa.Column("machine_id", sa.String(16), sa.ForeignKey("machines.machine_id"), nullable=False),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=False),
        sa.Column("ts_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ts_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_min", sa.Float, nullable=False),
        sa.Column("reason", sa.String(16), nullable=False),
    )

    op.create_table(
        "training_assignments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=False),
        sa.Column("scenario", sa.String(32), nullable=False),
        sa.Column("reason", sa.String(256), nullable=False),
        sa.Column("event_json", sa.Text, nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="assigned"),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "training_scores",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=False),
        sa.Column("scenario", sa.String(32), nullable=False),
        sa.Column("cycle_time_s", sa.Float, nullable=False),
        sa.Column("smoothness", sa.Float, nullable=False),
        sa.Column("fuel_per_cycle_l", sa.Float, nullable=False),
        sa.Column("idle_s", sa.Float, nullable=False),
        sa.Column("skill_factor_after", sa.Float, nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("operator_id", sa.String(16), sa.ForeignKey("operators.operator_id"), nullable=False),
        sa.Column("instructor_name", sa.String(64), nullable=False),
        sa.Column("slot_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slot_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="requested"),
        sa.Column("created_offline", sa.Boolean, nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_table("bookings")
    op.drop_table("training_scores")
    op.drop_table("training_assignments")
    op.drop_table("idle_tags")
    op.drop_table("incidents")
    op.drop_table("alerts")
    op.drop_table("sync_events")
    op.drop_table("telemetry_1min")
    op.drop_table("tasks")
    op.drop_table("model_bundles")
    op.drop_table("devices")
    op.drop_table("users")
    op.drop_table("sites")
    op.drop_table("operators")
    op.drop_table("machines")
