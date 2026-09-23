/**
 * Jest manual mock for `expo-sqlite`, backed by Node's real built-in `node:sqlite`
 * (Node 22+) instead of a hand-rolled fake — so `lib/db`/`lib/sync` tests run against
 * genuine SQLite semantics (real constraint enforcement, real `ON CONFLICT`, real
 * parameter binding), not an approximation that could pass while the real thing fails.
 * Automatically picked up by Jest for every `import ... from "expo-sqlite"` in tests —
 * see https://jestjs.io/docs/manual-mocks#mocking-node-modules.
 */
import { DatabaseSync } from "node:sqlite";

type BindParams = unknown[];

function normalizeParams(args: unknown[]): BindParams {
  // Mirrors the real expo-sqlite API: callers pass either variadic args or a single
  // array as the lone second argument.
  if (args.length === 1 && Array.isArray(args[0])) return args[0] as BindParams;
  return args;
}

class MockSQLiteDatabase {
  constructor(private readonly db: DatabaseSync) {}

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...args: unknown[]): Promise<{ lastInsertRowId: number; changes: number }> {
    const info = this.db.prepare(sql).run(...(normalizeParams(args) as never[]));
    return { lastInsertRowId: Number(info.lastInsertRowid), changes: Number(info.changes) };
  }

  async getAllAsync<T>(sql: string, ...args: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...(normalizeParams(args) as never[])) as T[];
  }

  async getFirstAsync<T>(sql: string, ...args: unknown[]): Promise<T | null> {
    const row = this.db.prepare(sql).get(...(normalizeParams(args) as never[]));
    return (row as T) ?? null;
  }
}

const namedDatabases = new Map<string, MockSQLiteDatabase>();

export async function openDatabaseAsync(name: string): Promise<MockSQLiteDatabase> {
  let db = namedDatabases.get(name);
  if (!db) {
    db = new MockSQLiteDatabase(new DatabaseSync(":memory:"));
    namedDatabases.set(name, db);
  }
  return db;
}

/** Test-only escape hatch — clears every named in-memory database so tests don't leak
 * state into each other across files/cases. */
export function _resetAllMockDatabases(): void {
  namedDatabases.clear();
}
