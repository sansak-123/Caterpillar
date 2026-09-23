import argparse
import json
import os
import time
from datetime import UTC, datetime

import paho.mqtt.client as mqtt

MACHINE_ID = "EXC001"
SITE_ID = "SITE01"


def main() -> None:
    parser = argparse.ArgumentParser(description="OperatorOS telemetry simulator")
    parser.add_argument("--mode", choices=["live", "demo"], default="live")
    args = parser.parse_args()

    host = os.environ.get("MQTT_HOST", "localhost")
    port = int(os.environ.get("MQTT_PORT", "1883"))
    topic = f"site/{SITE_ID}/machine/{MACHINE_ID}/telemetry"

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(host, port, keepalive=30)
    client.loop_start()

    print(f"[simulator] mode={args.mode} publishing to {topic} on {host}:{port}")
    try:
        while True:
            payload = {
                "ts": datetime.now(UTC).isoformat(),
                "machine_id": MACHINE_ID,
                "mode": args.mode,
            }
            client.publish(topic, json.dumps(payload))
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
