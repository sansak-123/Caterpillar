import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { StyleSheet } from "react-native";

import { BookIcon, ChatIcon, GridIcon, RadioIcon } from "../../components/icons";
import { TabIcon } from "../../components/TabIcon";
import { useIsWide } from "../../theme/useLayout";
import { useColors } from "../../theme/useColors";

export default function TabLayout() {
  const colors = useColors();
  // Wide screens navigate from the AppShell sidebar instead of a bottom tab bar.
  const isWide = useIsWide();

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: isWide
          ? { display: "none" }
          : {
              backgroundColor: colors.sidebar,
              borderTopColor: colors.border,
              borderTopWidth: StyleSheet.hairlineWidth,
              height: 72,
              paddingBottom: 10,
              paddingTop: 8,
              position: "absolute",
            },
        tabBarLabelStyle: { fontSize: 11.5, fontFamily: "Inter_600SemiBold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon focused={focused}>
              <GridIcon color={focused ? colors.textPrimary : (c as string)} size={20} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: "Live safety",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon focused={focused}>
              <RadioIcon color={focused ? colors.textPrimary : (c as string)} size={20} />
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
              <BookIcon color={focused ? colors.textPrimary : (c as string)} size={20} />
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
              <ChatIcon color={focused ? colors.textPrimary : (c as string)} size={20} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
