import { _resetDatabaseForTests } from "../db/database";
import { resetMockDatabases } from "../db/testHelpers";
import { listPendingOutbox } from "../sync/outbox";
import { aggregateAndQueueMinute, insertFrame, minuteBucket, pruneOldTelemetry } from "./aggregate";

beforeEach(() => {
  _resetDatabaseForTests();
  resetMockDatabases();
});

describe("minuteBucket", () => {
  it("truncates an ISO timestamp to the minute", () => {
    expect(minuteBucket("2026-09-24T10:15:42.123Z")).toBe("2026-09-24T10:15");
  });
});

describe("insertFrame + aggregateAndQueueMinute", () => {
  it("returns false and queues nothing for a minute with no buffered frames", async () => {
    const queued = await aggregateAndQueueMinute("EXC001", "2026-09-24T10:15");
    expect(queued).toBe(false);
    expect(await listPendingOutbox()).toHaveLength(0);
  });

  it("aggregates every frame in a minute into one outbox event", async () => {
    await insertFrame({
      ts: "2026-09-24T10:15:00.000Z",
      machine_id: "EXC001",
      operator_id: "OP1001",
      engine_on: true,
      state: "work",
      seatbelt: "Fastened",
      swing_rate_dps: 2,
      travel_kmh: 0,
      zone: "green",
    });
    await insertFrame({
      ts: "2026-09-24T10:15:30.000Z",
      machine_id: "EXC001",
      operator_id: "OP1001",
      engine_on: true,
      state: "work",
      seatbelt: "Unfastened",
      swing_rate_dps: 8,
      travel_kmh: 0,
      zone: "red",
    });
    // A frame in the NEXT minute must not be pulled into this aggregate.
    await insertFrame({
      ts: "2026-09-24T10:16:05.000Z",
      machine_id: "EXC001",
      operator_id: "OP1001",
      state: "work",
      zone: "green",
    });

    const queued = await aggregateAndQueueMinute("EXC001", "2026-09-24T10:15");
    expect(queued).toBe(true);

    const pending = await listPendingOutbox();
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe("telemetry_minute");
    const payload = JSON.parse(pending[0].payload_json);
    expect(payload.machine_id).toBe("EXC001");
    expect(payload.swing_rate_dps).toBe(5); // average of 2 and 8
    expect(payload.zone).toBe("red"); // worst zone in the minute wins, not the most common one
  });

  it("only aggregates frames for the requested machine", async () => {
    await insertFrame({ ts: "2026-09-24T10:15:00.000Z", machine_id: "EXC001", zone: "green" });
    await insertFrame({ ts: "2026-09-24T10:15:10.000Z", machine_id: "WLD001", zone: "amber" });

    const queued = await aggregateAndQueueMinute("EXC001", "2026-09-24T10:15");
    expect(queued).toBe(true);
    const payload = JSON.parse((await listPendingOutbox())[0].payload_json);
    expect(payload.machine_id).toBe("EXC001");
    expect(payload.zone).toBe("green");
  });
});

describe("pruneOldTelemetry", () => {
  it("deletes frames older than 24h but keeps recent ones", async () => {
    const now = new Date("2026-09-24T12:00:00.000Z").getTime();
    await insertFrame({ ts: "2026-09-23T11:00:00.000Z", machine_id: "EXC001", zone: "green" }); // 25h old
    await insertFrame({ ts: "2026-09-24T11:00:00.000Z", machine_id: "EXC001", zone: "green" }); // 1h old

    await pruneOldTelemetry(now);

    const remaining = await aggregateAndQueueMinute("EXC001", "2026-09-23T11:00");
    expect(remaining).toBe(false); // pruned away

    const stillThere = await aggregateAndQueueMinute("EXC001", "2026-09-24T11:00");
    expect(stillThere).toBe(true);
  });
});
