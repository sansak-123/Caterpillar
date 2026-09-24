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
    <View style={styles.row}>
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
            {
              backgroundColor: l.code === language ? colors.accent : colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[type.caption, { color: l.code === language ? colors.accentOn : colors.textSecondary, fontWeight: "700" }]}
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
    gap: 4,
  },
  chip: {
    minWidth: 32,
    minHeight: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
});
