import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

import "../i18n"; // side-effect: initializes i18next once, before any screen renders translated text

import { AppShell } from "../components/AppShell";
import { ensureDemoSession } from "../lib/api/client";
import { useSyncEngine } from "../lib/sync/engine";
import { useAuthStore } from "../store/auth";
import { useColors } from "../theme/useColors";

export default function RootLayout() {
  const colors = useColors();
  const setSession = useAuthStore((s) => s.setSession);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

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

  // Bundled locally (no network wait) — a brief blank frame beats every piece of text
  // flashing from the system font to Inter a moment after first paint.
  if (!fontsLoaded) return null;

  // Checklist / shift log / supervisor / demo render their own page header (with a
  // Back link on phones, and the sidebar on wide screens), so only the simulator keeps
  // a native header.
  return (
    <SafeAreaProvider>
      <StatusBar style={colors.mode === "light" ? "dark" : "light"} />
      <AppShell>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="checklist" options={{ title: "Pre-start check" }} />
          <Stack.Screen name="shift-log" options={{ title: "Shift log" }} />
          <Stack.Screen name="demo" options={{ title: "Demo panel" }} />
          <Stack.Screen
            name="simulator"
            options={{
              headerShown: true,
              title: "Simulator",
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.textPrimary,
              headerTitleStyle: { fontFamily: "Inter_700Bold", fontSize: 16 },
            }}
          />
          <Stack.Screen name="supervisor" options={{ title: "Supervisor" }} />
        </Stack>
      </AppShell>
    </SafeAreaProvider>
  );
}
