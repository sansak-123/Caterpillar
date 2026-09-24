import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../i18n"; // side-effect: initializes i18next once, before any screen renders translated text

import { ensureDemoSession } from "../lib/api/client";
import { useSyncEngine } from "../lib/sync/engine";
import { useAuthStore } from "../store/auth";
import { useColors } from "../theme/useColors";

export default function RootLayout() {
  const colors = useColors();
  const setSession = useAuthStore((s) => s.setSession);
  const hydrate = useAuthStore((s) => s.hydrate);

  // Bootstrapped once, here, rather than by whichever screen happens to mount first —
  // every screen just reads the token reactively from useAuthStore afterwards. Stands
  // in for a real login screen (out of scope for now); see README "known gaps".
  //
  // Two sources race harmlessly: `hydrate()` restores whatever was in secure storage
  // from last run (works immediately, even fully offline), while `ensureDemoSession()`
  // gets a fresh token when there's a connection (JWTs expire — see JWT_EXPIRES_MINUTES).
  // Whichever resolves last wins; both write through setSession's own persistence.
  useEffect(() => {
    hydrate();
    ensureDemoSession()
      .then(({ token, operatorId }) => setSession(token, operatorId))
      .catch(() => {
        // No backend reachable — screens fall back to their own demo data, or to
        // whatever hydrate() already restored.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CLAUDE.md §3.1: the sync engine runs continuously from app start, regardless of
  // which tab is active — mounted once here, not per-screen.
  useSyncEngine();
  return (
    <SafeAreaProvider>
      <StatusBar style={colors.mode === "light" ? "dark" : "light"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="checklist"
          options={{
            headerShown: true,
            title: "Pre-Start Checklist",
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
          }}
        />
        <Stack.Screen
          name="shift-log"
          options={{
            headerShown: true,
            title: "End-of-Shift Log",
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
          }}
        />
        <Stack.Screen
          name="demo"
          options={{
            headerShown: true,
            title: "Demo Panel",
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
          }}
        />
        <Stack.Screen
          name="simulator"
          options={{
            headerShown: true,
            title: "Simulator",
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
          }}
        />
        <Stack.Screen
          name="supervisor"
          options={{
            headerShown: true,
            title: "Supervisor View",
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
