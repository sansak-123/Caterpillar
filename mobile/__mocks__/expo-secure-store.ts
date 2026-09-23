/**
 * Jest manual mock for `expo-secure-store` — the real module is a native
 * Keychain/Keystore binding with nothing to run in Jest's Node environment.
 * Auto-picked-up for every `import ... from "expo-secure-store"` in tests, same
 * mechanism as `__mocks__/expo-sqlite.ts`.
 */
const store = new Map<string, string>();

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function getItemAsync(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

export function _resetMockSecureStore(): void {
  store.clear();
}
