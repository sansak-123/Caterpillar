import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColors } from "../theme/useColors";

export default function RootLayout() {
  const colors = useColors();
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
      </Stack>
    </SafeAreaProvider>
  );
}
