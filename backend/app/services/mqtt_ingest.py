"""Ingest worker — CLAUDE.md section 3/9: subscribes to `site/+/machine/+/telemetry`
and upserts each message as a 1-minute telemetry aggregate. The device only ever
uploads 1-min aggregates (raw 1 Hz stays on-device per section 3.1), so this worker
does not do any downsampling itself — it trusts the payload's own `ts` granularity.

Run as `python -m app.services.mqtt_ingest` (needs a reachable Mosquitto broker).
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging

import aiomqtt
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.core.config import get_settings
from app.db.session import async_session_factory, engine
from app.models import TelemetryMinute

logger = logging.getLogger("app.services.mqtt_ingest")

TOPIC_FILTER = "site/+/machine/+/telemetry"


def _parse_topic(topic: str) -> tuple[str, str]:
    # site/{site_id}/machine/{machine_id}/telemetry
    parts = topic.split("/")
    return parts[1], parts[3]


def _row_from_payload(site_id: str, machine_id: str, payload: dict) -> dict | None:
    if "operator_id" not in payload:
        return None  # not a full telemetry frame yet (e.g. the Phase 0 heartbeat stub)

    ts = payload.get("ts")
    ts_dt = dt.datetime.fromisoformat(ts) if ts else dt.datetime.utcnow()
    return {
        "ts": ts_dt,
        "machine_id": machine_id,
        "operator_id": payload["operator_id"],
        "site_id": site_id,
        "engine_on": bool(payload.get("engine_on", True)),
        "state": payload.get("state", "work"),
        "seatbelt": payload.get("seatbelt", "Fastened"),
        "swing_rate_dps": float(payload.get("swing_rate_dps", 0)),
        "travel_kmh": float(payload.get("travel_kmh", 0)),
        "reverse": bool(payload.get("reverse", False)),
        "fuel_rate_lph": float(payload.get("fuel_rate_lph", 0)),
        "nearest_person_m": payload.get("nearest_person_m"),
        "zone": payload.get("zone"),
    }


async def _upsert(row: dict) -> None:
    dialect = engine.dialect.name
    insert_fn = pg_insert if dialect == "postgresql" else sqlite_insert
    stmt = insert_fn(TelemetryMinute).values(**row)
    update_cols = {c: getattr(stmt.excluded, c) for c in row if c not in ("ts", "machine_id")}
    stmt = stmt.on_conflict_do_update(index_elements=["ts", "machine_id"], set_=update_cols)

    async with async_session_factory() as session:
        await session.execute(stmt)
        await session.commit()


async def run_ingest_worker() -> None:
    settings = get_settings()
    logger.info("Connecting to MQTT broker %s:%s", settings.mqtt_host, settings.mqtt_port)

    async with aiomqtt.Client(settings.mqtt_host, port=settings.mqtt_port) as client:
        await client.subscribe(TOPIC_FILTER)
        logger.info("Subscribed to %s", TOPIC_FILTER)
        async for message in client.messages:
            try:
                site_id, machine_id = _parse_topic(str(message.topic))
                payload = json.loads(message.payload)
                row = _row_from_payload(site_id, machine_id, payload)
                if row is not None:
                    await _upsert(row)
            except Exception:
                logger.exception("Failed to ingest message on %s", message.topic)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_ingest_worker())
