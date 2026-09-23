import * as SecureStore from "expo-secure-store";

/** Same pattern as lib/db/testHelpers.ts's resetMockDatabases — the real
 * expo-secure-store has no `_resetMockSecureStore` export; it only exists on the Jest
 * manual mock. One typed cast here instead of `as any` at every call site. */
export function resetMockSecureStore(): void {
  (SecureStore as typeof SecureStore & { _resetMockSecureStore?: () => void })._resetMockSecureStore?.();
}
