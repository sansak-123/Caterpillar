import * as ExpoSQLite from "expo-sqlite";

/**
 * The real `expo-sqlite` package has no `_resetAllMockDatabases` export — it only
 * exists on the Jest manual mock (`__mocks__/expo-sqlite.ts`) that test runs swap in.
 * This one cast lives here so every test file can call a properly-typed function
 * instead of reaching for `as any` at each call site; it's a safe no-op if this ever
 * somehow runs against the real module.
 */
export function resetMockDatabases(): void {
  (ExpoSQLite as typeof ExpoSQLite & { _resetAllMockDatabases?: () => void })._resetAllMockDatabases?.();
}
