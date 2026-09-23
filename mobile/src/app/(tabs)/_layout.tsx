import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";

import { AssistantIcon, SafetyIcon, TodayIcon, TrainingIcon } from "../../components/icons";
import { TabIcon } from "../../components/TabIcon";
import { useColors } from "../../theme/useColors";

export default function TabLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDarkOn,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarBackground: () => (
          <BlurView intensity={colors.mode === "light" ? 70 : 50} tint={colors.mode} style={StyleSheet.absoluteFill} />
        ),
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          position: "absolute",
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon focused={focused}>
              <TodayIcon color={focused ? colors.primaryDarkOn : (c as string)} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: "Safety",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon focused={focused}>
              <SafetyIcon color={focused ? colors.primaryDarkOn : (c as string)} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: "Training",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon focused={focused}>
              <TrainingIcon color={focused ? colors.primaryDarkOn : (c as string)} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "Assistant",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon focused={focused}>
              <AssistantIcon color={focused ? colors.primaryDarkOn : (c as string)} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
