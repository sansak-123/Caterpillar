import { Tabs } from "expo-router";

import { AssistantIcon, SafetyIcon, TodayIcon, TrainingIcon } from "../../components/icons";
import { color } from "../../theme/tokens";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarIcon: ({ color: c }) => <TodayIcon color={c as string} /> }}
      />
      <Tabs.Screen
        name="safety"
        options={{ title: "Safety", tabBarIcon: ({ color: c }) => <SafetyIcon color={c as string} /> }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: "Training",
          tabBarIcon: ({ color: c }) => <TrainingIcon color={c as string} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "Assistant",
          tabBarIcon: ({ color: c }) => <AssistantIcon color={c as string} />,
        }}
      />
    </Tabs>
  );
}
