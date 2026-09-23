"""OperatorOS telemetry simulator — CLAUDE.md §1/§9/Phase 9. Publishes 1 Hz frames to
`site/{SITE_ID}/machine/{MACHINE_ID}/telemetry` for the backend's MQTT ingest worker
(`app/services/mqtt_ingest.py`), which expects: ts, operator_id, engine_on, state,
seatbelt, swing_rate_dps, travel_kmh, reverse, fuel_rate_lph, nearest_person_m, zone.

Two modes:
- `live`: a simple, indefinitely-cycling work/idle/travel state machine — enough to make
  the backend's live views show something other than static demo data.
- `demo`: the scripted narrative arc from CLAUDE.md §2 ("Demo narrative arc"), replayed
  on a loop so a presenter can start it once and rehearse repeatedly. Only the
  telemetry-representable beats are driven here (seatbelt-off/idle, a worker closing
  into the rear blind spot during a swing, the red-zone/near-miss window, recovery) —
  the network-cut, sync, supervisor-view, and Unity-replay beats are presenter actions
  inside the app itself (the dev Demo Panel's Cut-network toggle, the Training tab),
  not something a telemetry publisher can drive.

The proximity-zone classification below is a deliberately minimal mirror of the same
formula implemented independently in `backend/app/rules/live.py` (Python) and
`mobile/src/lib/safety/proximity.ts` (TypeScript) — three independent ports of one
small formula, kept in sync by hand, same as those two already are with each other.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import time
from dataclasses import dataclass

import paho.mqtt.client as mqtt

MACHINE_ID = "EXC001"
OPERATOR_ID = "OP1001"
SITE_ID = "SITE01"

BASE_RADIUS_M = 12.0  # excavator, matches BASE_RADIUS_M["excavator"] on both other sides


def proximity_zone(nearest_person_m: float | None, is_swinging: bool) -> str:
    if nearest_person_m is None:
        return "green"
    state_factor = 1.3 if is_swinging else 1.0
    amber_m = BASE_RADIUS_M * state_factor * 1.5  # rear-sector weighting, always on here
    red_m = amber_m * 0.4
    if nearest_person_m < red_m:
        return "red"
    if nearest_person_m < amber_m:
        return "amber"
    return "green"


@dataclass
class Frame:
    engine_on: bool
    state: str
    seatbelt: str
    swing_rate_dps: float
    travel_kmh: float
    reverse: bool
    fuel_rate_lph: float
    nearest_person_m: float | None


def normal_work_frame() -> Frame:
    return Frame(True, "work", "Fastened", 2.0, 0.0, False, 14.0, None)


def make_publisher(client: mqtt.Client, topic: str):
    def publish(frame: Frame) -> None:
        payload = {
            "ts": dt.datetime.now(dt.timezone.utc).isoformat(),
            "machine_id": MACHINE_ID,
            "operator_id": OPERATOR_ID,
            "engine_on": frame.engine_on,
            "state": frame.state,
            "seatbelt": frame.seatbelt,
            "swing_rate_dps": frame.swing_rate_dps,
            "travel_kmh": frame.travel_kmh,
            "reverse": frame.reverse,
            "fuel_rate_lph": frame.fuel_rate_lph,
            "nearest_person_m": frame.nearest_person_m,
            "zone": proximity_zone(frame.nearest_person_m, frame.swing_rate_dps > 5),
        }
        client.publish(topic, json.dumps(payload))
        return payload

    return publish


def run_live(publish, hz: float) -> None:
    """Cycles work -> idle -> travel indefinitely, nothing scripted."""
    cycle = [
        ("work", Frame(True, "work", "Fastened", 3.0, 0.0, False, 16.0, None), 20),
        ("idle", Frame(True, "idle", "Fastened", 0.0, 0.0, False, 3.5, None), 10),
        ("travel", Frame(True, "travel", "Fastened", 0.0, 12.0, False, 10.0, None), 15),
    ]
    print(f"[simulator] mode=live — cycling {[name for name, _, _ in cycle]} indefinitely")
    while True:
        for name, frame, seconds in cycle:
            print(f"[simulator] live: {name} ({seconds}s)")
            for _ in range(int(seconds * hz)):
                publish(frame)
                time.sleep(1 / hz)


# CLAUDE.md §2 "Demo narrative arc" — beat, frame, duration in seconds. Distances close
# and reopen linearly within a beat via _interpolate_beat below.
DemoBeat = tuple[str, Frame, Frame, int]

DEMO_SCRIPT: list[DemoBeat] = [
    (
        "Normal work — seatbelt fastened, no one nearby",
        normal_work_frame(),
        normal_work_frame(),
        30,
    ),
    (
        "10:00 seatbelt off + idle spike (seed row scenario)",
        Frame(True, "idle", "Unfastened", 0.0, 0.0, False, 3.8, None),
        Frame(True, "idle", "Unfastened", 0.0, 0.0, False, 3.8, None),
        45,
    ),
    (
        "Back to work, belt refastened — worker begins closing into the rear blind spot during a swing",
        Frame(True, "work", "Fastened", 8.0, 0.0, False, 15.0, 15.0),
        Frame(True, "work", "Fastened", 8.0, 0.0, False, 15.0, 3.0),
        40,
    ),
    (
        "RED ZONE — worker in blind spot while swinging (near-miss trigger window)",
        Frame(True, "work", "Fastened", 8.0, 0.0, False, 15.0, 2.5),
        Frame(True, "work", "Fastened", 8.0, 0.0, False, 15.0, 2.5),
        20,
    ),
    (
        "Recovery — worker clears the zone, swing stops",
        Frame(True, "work", "Fastened", 8.0, 0.0, False, 15.0, 2.5),
        Frame(True, "work", "Fastened", 0.0, 0.0, False, 15.0, 20.0),
        30,
    ),
]


def _interpolate(start: float | None, end: float | None, t: float) -> float | None:
    if start is None or end is None:
        return end
    return start + (end - start) * t


def run_demo(publish, hz: float, speed: float) -> None:
    total_s = sum(seconds for _, _, _, seconds in DEMO_SCRIPT) / speed
    print(f"[simulator] mode=demo — {len(DEMO_SCRIPT)} beats, ~{total_s:.0f}s per loop at speed={speed}x")
    print(
        "[simulator] network-cut / sync / supervisor-view / Unity-replay beats are presenter "
        "actions in the app itself, not driven by this publisher."
    )
    loop = 1
    while True:
        print(f"\n[simulator] === demo loop {loop} ===")
        for beat_name, start, end, seconds in DEMO_SCRIPT:
            duration = max(seconds / speed, 0.2)
            print(f"[simulator] beat: {beat_name} ({duration:.1f}s)")
            steps = max(int(duration * hz), 1)
            for i in range(steps):
                t = i / steps
                frame = Frame(
                    engine_on=start.engine_on,
                    state=end.state if t > 0.5 else start.state,
                    seatbelt=end.seatbelt if t > 0.5 else start.seatbelt,
                    swing_rate_dps=_interpolate(start.swing_rate_dps, end.swing_rate_dps, t) or 0.0,
                    travel_kmh=_interpolate(start.travel_kmh, end.travel_kmh, t) or 0.0,
                    reverse=end.reverse,
                    fuel_rate_lph=_interpolate(start.fuel_rate_lph, end.fuel_rate_lph, t) or 0.0,
                    nearest_person_m=_interpolate(start.nearest_person_m, end.nearest_person_m, t),
                )
                payload = publish(frame)
                if i == 0 or i == steps - 1:
                    print(f"    zone={payload['zone']} seatbelt={payload['seatbelt']} nearest_person_m={payload['nearest_person_m']}")
                time.sleep(1 / hz)
        loop += 1


def main() -> None:
    import os

    parser = argparse.ArgumentParser(description="OperatorOS telemetry simulator")
    parser.add_argument("--mode", choices=["live", "demo"], default="live")
    parser.add_argument("--hz", type=float, default=1.0, help="publish rate in Hz")
    parser.add_argument("--speed", type=float, default=4.0, help="demo mode time compression (default 4x)")
    args = parser.parse_args()

    host = os.environ.get("MQTT_HOST", "localhost")
    port = int(os.environ.get("MQTT_PORT", "1883"))
    topic = f"site/{SITE_ID}/machine/{MACHINE_ID}/telemetry"

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(host, port, keepalive=30)
    client.loop_start()
    publish = make_publisher(client, topic)

    print(f"[simulator] publishing to {topic} on {host}:{port}")
    try:
        if args.mode == "demo":
            run_demo(publish, args.hz, args.speed)
        else:
            run_live(publish, args.hz)
    except KeyboardInterrupt:
        pass
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
