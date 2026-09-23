import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * CLAUDE.md §3.2: "JWT + device token stored in expo-secure-store (Keychain/Keystore-
 * backed), never AsyncStorage/plain SQLite." `expo-secure-store` has no web
 * implementation at all — native-only by design, since there's no OS keychain to back
 * it with in a browser. This dev environment's only way to verify the rest of the app
 * end-to-end is the web preview, so this wrapper falls back to `localStorage` there.
 * That fallback is NOT a secure boundary and is not the real security story — it exists
 * purely so session persistence is testable here; real builds run on native, where
 * every call below goes straight to the Keychain/Keystore as the spec requires.
 */

const isWeb = Platform.OS === "web";

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing / storage disabled — session just won't persist across reloads.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clean up if storage was never available.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
