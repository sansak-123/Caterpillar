import * as client from "../api/client";
import { _resetDatabaseForTests, getDatabase } from "../db/database";
import { resetMockDatabases } from "../db/testHelpers";
import { appendToOutbox, countPendingOutbox, getSyncCursor, listPendingOutbox } from "./outbox";
import { drainOutbox, pullFromServer } from "./engine";

jest.mock("../api/client");
const mockedClient = client as jest.Mocked<typeof client>;

beforeEach(() => {
  _resetDatabaseForTests();
  resetMockDatabases();
  jest.resetAllMocks();
});

describe("drainOutbox", () => {
  it("does nothing and calls nothing when the outbox is empty", async () => {
    const result = await drainOutbox("token");
    expect(result).toEqual({ attempted: 0, acked: 0 });
    expect(mockedClient.pushSyncEvents).not.toHaveBeenCalled();
  });

  it("pushes pending events and clears the ones the server acked", async () => {
    const id1 = await appendToOutbox("alert", { a: 1 });
    const id2 = await appendToOutbox("alert", { a: 2 });
    mockedClient.pushSyncEvents.mockResolvedValue({ acked: [id1, id2] });

    const result = await drainOutbox("token");

    expect(result).toEqual({ attempted: 2, acked: 2 });
    expect(await countPendingOutbox()).toBe(0);
  });

  it("keeps an unacked event pending (as failed, for retry) rather than dropping it", async () => {
    const id = await appendToOutbox("alert", {});
    mockedClient.pushSyncEvents.mockResolvedValue({ acked: [] });

    await drainOutbox("token");

    const pending = await listPendingOutbox();
    expect(pending.map((p) => p.event_id)).toEqual([id]);
    expect(pending[0].status).toBe("failed");
    expect(pending[0].attempt).toBe(1);
  });

  it("marks everything failed (not lost) when the push call throws — e.g. offline", async () => {
    await appendToOutbox("alert", {});
    mockedClient.pushSyncEvents.mockRejectedValue(new Error("network down"));

    const result = await drainOutbox("token");

    expect(result.acked).toBe(0);
    expect(await countPendingOutbox()).toBe(1); // still queued, not silently dropped
  });
});

describe("pullFromServer", () => {
  it("upserts pulled tasks into the local table and advances the cursor", async () => {
    mockedClient.fetchSyncPull.mockResolvedValue({
      cursor: "2026-09-24T01:00:00",
      tasks: [
        {
          task_id: "T1",
          operator_id: "OP1001",
          machine_id: "EXC001",
          task_type: "Grading",
          status: "pending",
          est_min: 35,
          p50_min: 34,
          p90_min: 40,
          version: 1,
          conflict: false,
        },
      ],
      bookings: [],
      training_assignments: [],
      model_bundle: null,
    });

    await pullFromServer("token");

    expect(await getSyncCursor()).toBe("2026-09-24T01:00:00");
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ task_type: string; status: string; version: number }>(
      "SELECT * FROM tasks WHERE task_id = 'T1'"
    );
    expect(row).toMatchObject({ task_type: "Grading", status: "pending", version: 1 });
  });

  it("updates an existing task in place on a second pull (ON CONFLICT upsert)", async () => {
    mockedClient.fetchSyncPull.mockResolvedValueOnce({
      cursor: "c1",
      tasks: [
        {
          task_id: "T1",
          operator_id: "OP1001",
          machine_id: "EXC001",
          task_type: "Grading",
          status: "pending",
          est_min: 35,
          p50_min: 34,
          p90_min: 40,
          version: 1,
          conflict: false,
        },
      ],
      bookings: [],
      training_assignments: [],
      model_bundle: null,
    });
    await pullFromServer("token");

    mockedClient.fetchSyncPull.mockResolvedValueOnce({
      cursor: "c2",
      tasks: [
        {
          task_id: "T1",
          operator_id: "OP1001",
          machine_id: "EXC001",
          task_type: "Grading",
          status: "in_progress",
          est_min: 35,
          p50_min: 34,
          p90_min: 40,
          version: 2,
          conflict: false,
        },
      ],
      bookings: [],
      training_assignments: [],
      model_bundle: null,
    });
    await pullFromServer("token");

    const db = await getDatabase();
    const rows = await db.getAllAsync("SELECT * FROM tasks WHERE task_id = 'T1'");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "in_progress", version: 2 });
  });
});
