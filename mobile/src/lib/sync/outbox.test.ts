import { _resetDatabaseForTests } from "../db/database";
import { resetMockDatabases } from "../db/testHelpers";
import {
  appendToOutbox,
  countPendingOutbox,
  getSyncCursor,
  listPendingOutbox,
  markOutboxAcked,
  markOutboxFailed,
  setSyncCursor,
} from "./outbox";

beforeEach(() => {
  _resetDatabaseForTests();
  resetMockDatabases();
});

describe("outbox", () => {
  it("appends an event and lists it as pending", async () => {
    const id = await appendToOutbox("incident_confirm", { incident_id: "NM1" });
    const pending = await listPendingOutbox();

    expect(pending).toHaveLength(1);
    expect(pending[0].event_id).toBe(id);
    expect(pending[0].type).toBe("incident_confirm");
    expect(JSON.parse(pending[0].payload_json)).toEqual({ incident_id: "NM1" });
    expect(await countPendingOutbox()).toBe(1);
  });

  it("assigns one stable device id across multiple appends", async () => {
    await appendToOutbox("alert", {});
    await appendToOutbox("alert", {});
    const pending = await listPendingOutbox();
    expect(pending[0].device_id).toBe(pending[1].device_id);
  });

  it("marks events acked and drops them from the pending count", async () => {
    const id1 = await appendToOutbox("alert", {});
    const id2 = await appendToOutbox("alert", {});

    await markOutboxAcked([id1]);

    expect(await countPendingOutbox()).toBe(1);
    const pending = await listPendingOutbox();
    expect(pending.map((p) => p.event_id)).toEqual([id2]);
  });

  it("keeps failed events retryable with an incremented attempt count", async () => {
    const id = await appendToOutbox("alert", {});
    await markOutboxFailed([id]);

    const pending = await listPendingOutbox();
    expect(pending).toHaveLength(1);
    expect(pending[0].attempt).toBe(1);
    expect(pending[0].status).toBe("failed");
  });

  it("stores and retrieves the sync pull cursor", async () => {
    expect(await getSyncCursor()).toBeNull();
    await setSyncCursor("2026-09-24T00:00:00");
    expect(await getSyncCursor()).toBe("2026-09-24T00:00:00");
  });
});
