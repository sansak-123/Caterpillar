import { Pressable, StyleSheet, Text, View } from "react-native";

import * as Haptics from "expo-haptics";

import type { AssistantLanguage } from "../lib/assistant/voice";
import { useLanguageStore } from "../store/language";
import { useColors } from "../theme/useColors";
import { radius, spacing, type } from "../theme/tokens";

const LANGUAGES: { code: AssistantLanguage; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "HI" },
  { code: "ta", label: "TA" },
];

/** CLAUDE.md §2.1 Rule 6 + i18n scope (en/hi/ta) — one switch for both the general UI
 * text (src/i18n) and the assistant's voice (lib/assistant/voice.ts), since both read
 * from the same store/language.ts. */
export function LanguageSwitcher() {
  const colors = useColors();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {LANGUAGES.map((l) => (
        <Pressable
          key={l.code}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${l.label}`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setLanguage(l.code);
          }}
          style={[
            styles.chip,
            { backgroundColor: l.code === language ? colors.accent : "transparent" },
          ]}
        >
          <Text
            style={[type.small, { color: l.code === language ? colors.accentOn : colors.textSecondary, fontFamily: "Inter_700Bold" }]}
          >
            {l.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  chip: {
    minWidth: 30,
    minHeight: 28,
    borderRadius: radius.sm - 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
});
