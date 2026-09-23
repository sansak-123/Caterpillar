import { _resetDatabaseForTests, getDatabase } from "./database";
import { resetMockDatabases } from "./testHelpers";

beforeEach(() => {
  _resetDatabaseForTests();
  resetMockDatabases();
});

describe("getDatabase", () => {
  it("creates every table from CLAUDE.md §3.1's table list", async () => {
    const db = await getDatabase();
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "tasks",
        "telemetry_buffer",
        "alerts",
        "incidents",
        "idle_tags",
        "training_progress",
        "bookings",
        "outbox",
        "model_bundles",
        "kb_docs",
        "sync_meta",
      ])
    );
  });

  it("returns the same handle on repeated calls instead of reopening", async () => {
    const db1 = await getDatabase();
    const db2 = await getDatabase();
    expect(db1).toBe(db2);
  });
});
