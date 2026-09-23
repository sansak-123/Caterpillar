import * as SQLite from "expo-sqlite";

import { SCHEMA_SQL } from "./schema";

const DB_NAME = "operatoros.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opens (once) and migrates the on-device database. Safe to call repeatedly — every
 * caller awaits the same open+migrate promise instead of racing separate opens. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(SCHEMA_SQL);
      return db;
    });
  }
  return dbPromise;
}

/** Test-only: drops the cached handle so the next getDatabase() call reopens fresh.
 * Jest's expo-sqlite mock keeps state per require(), so tests that need isolation
 * import this to reset between cases. */
export function _resetDatabaseForTests(): void {
  dbPromise = null;
}
