"""Run every data generator in dependency order — `python data/generators/run_all.py`."""

from __future__ import annotations

import time

import machines
import operators
import sites
import weather
import telemetry
import tasks
import schedule_today
import idle_tags
import cycles
import incidents
import aggregate

STEPS = [
    ("machines", machines.main),
    ("sites", sites.main),
    ("operators", operators.main),
    ("weather", weather.main),
    ("telemetry", telemetry.main),
    ("tasks", tasks.main),
    ("schedule_today", schedule_today.main),
    ("idle_tags", idle_tags.main),
    ("cycles", cycles.main),
    ("incidents", incidents.main),
    ("aggregate", aggregate.main),
]


def main() -> None:
    for name, step in STEPS:
        t0 = time.time()
        step()
        print(f"  ... {name} done in {time.time() - t0:.1f}s\n")


if __name__ == "__main__":
    main()
