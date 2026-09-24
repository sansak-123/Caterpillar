import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { AssistantIcon, MicIcon, StopIcon } from "../components/icons";
import { Badge } from "../components/Badge";
import { ConnectivityPill } from "../components/ConnectivityPill";
import { GlassCard } from "../components/GlassCard";
import { ScreenBackground } from "../components/ScreenBackground";
import { type ChatMessage, useAssistant } from "../lib/assistant/useAssistant";
import { useVoiceInput, type AssistantLanguage } from "../lib/assistant/voice";
import { useLanguageStore } from "../store/language";
import { useColors } from "../theme/useColors";
import { radius, shadow, spacing, touchTarget, type } from "../theme/tokens";

type QuickAction = { id: string; label: string };

const quickActions: QuickAction[] = [
  { id: "explain_estimate", label: "Explain estimate" },
  { id: "safety_question", label: "Safety help" },
  { id: "log_incident", label: "Log incident (voice)" },
  { id: "book_instructor", label: "Book instructor" },
];

const LANGUAGES: { code: AssistantLanguage; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "HI" },
  { code: "ta", label: "TA" },
];

export function AssistantScreen() {
  const colors = useColors();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const { messages, busy, isOnline, sendMessage, logIncident, bookInstructor } = useAssistant(language);
  const voice = useVoiceInput(language);
  const [input, setInput] = useState("");
  const pendingIncidentRef = useRef(false);
  const wasListeningRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (wasListeningRef.current && !voice.listening) {
      const text = voice.finalTranscript();
      if (text.trim()) {
        if (pendingIncidentRef.current) {
          logIncident(text);
        } else {
          sendMessage(text);
        }
      }
      pendingIncidentRef.current = false;
    }
    wasListeningRef.current = voice.listening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.listening]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  function runQuickAction(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (id === "explain_estimate") {
      sendMessage("explain my estimate for today");
      return;
    }
    if (id === "safety_question") {
      sendMessage("tell me about the safety features on this machine");
      return;
    }
    if (id === "book_instructor") {
      bookInstructor();
      return;
    }
    if (id === "log_incident") {
      pendingIncidentRef.current = true;
      voice.start();
    }
  }

  function toggleMic() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (voice.listening) {
      voice.stop();
    } else {
      pendingIncidentRef.current = false;
      voice.start();
    }
  }

  function submitTyped() {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={[type.label, { color: colors.textMuted }]}>ASSISTANT</Text>
            <View style={styles.headerRight}>
              <View style={styles.langRow}>
                {LANGUAGES.map((l) => (
                  <Pressable
                    key={l.code}
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${l.label}`}
                    onPress={() => setLanguage(l.code)}
                    style={[
                      styles.langChip,
                      {
                        backgroundColor: l.code === language ? colors.accent : colors.surfaceRaised,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        type.caption,
                        { color: l.code === language ? colors.accentOn : colors.textSecondary, fontWeight: "700" },
                      ]}
                    >
                      {l.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <ConnectivityPill />
            </View>
          </View>
          <Text style={[type.display, { color: colors.textPrimary }]}>How can I help?</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            {isOnline
              ? "Online — answers use the OpenRouter assistant model, grounded in your real tasks and flags."
              : "Offline — answering from the on-device safety knowledge base only."}
          </Text>

          <View style={styles.quickGrid}>
            {quickActions.map((a, i) => (
              <Animated.View key={a.id} entering={FadeInDown.delay(i * 60).duration(350)} style={styles.tileWrap}>
                <Pressable
                  onPress={() => runQuickAction(a.id)}
                  style={({ pressed }) => [
                    styles.actionTile,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                    shadow.card(colors.mode),
                    pressed ? { opacity: 0.75 } : null,
                  ]}
                >
                  <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{a.label}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} colors={colors} />
            ))}
            {busy ? <Text style={[type.caption, { color: colors.textMuted }]}>Thinking…</Text> : null}
            {voice.error ? <Text style={[type.caption, { color: colors.danger }]}>{voice.error}</Text> : null}
          </ScrollView>

          <View
            style={[
              styles.inputBar,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              shadow.card(colors.mode),
            ]}
          >
            <TextInput
              value={voice.listening ? voice.transcript || "Listening…" : input}
              onChangeText={setInput}
              onSubmitEditing={submitTyped}
              editable={!voice.listening}
              placeholder="Type or hold to talk…"
              placeholderTextColor={colors.textMuted}
              style={[type.body, styles.textInput, { color: colors.textPrimary }]}
              returnKeyType="send"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={voice.listening ? "Stop listening" : "Start voice input"}
              testID="assistant-mic-button"
              onPress={toggleMic}
              style={[
                styles.micButton,
                { backgroundColor: voice.listening ? colors.danger : colors.accent },
                shadow.glow(voice.listening ? colors.dangerGlow : colors.accentGlow),
              ]}
            >
              {voice.listening ? (
                <StopIcon color={colors.accentOn} size={18} />
              ) : (
                <MicIcon color={colors.accentOn} size={20} />
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function MessageBubble({
  message,
  colors,
}: {
  message: ChatMessage;
  colors: ReturnType<typeof useColors>;
}) {
  if (message.role === "user") {
    return (
      <View style={[styles.userBubble, { backgroundColor: colors.accent }]}>
        <Text style={[type.body, { color: colors.accentOn }]}>{message.text}</Text>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <GlassCard glowColor={colors.infoGlow} style={styles.assistantCard}>
        <View style={styles.messageRow}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <AssistantIcon color={colors.accentOn} size={18} />
          </View>
          <View style={styles.bubble}>
            <Text style={[type.body, { color: colors.textPrimary }]}>{message.text}</Text>
            {message.meta?.kind === "incident_draft" ? (
              <View style={styles.metaRow}>
                <Badge label={message.meta.incident.severity} tone="caution" />
                <Badge label={`${Math.round(message.meta.incident.confidence * 100)}% confidence`} tone="neutral" />
              </View>
            ) : null}
            {message.meta?.kind === "booking" ? (
              <View style={styles.metaRow}>
                <Badge label={message.meta.booking.status} tone="info" />
              </View>
            ) : null}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    // The tab bar floats over the screen (position: absolute, height 72 — see
    // (tabs)/_layout.tsx) instead of reserving layout space, so without this the input
    // bar (and its mic button) renders right underneath it, invisible/unreachable —
    // other screens compensate the same way (e.g. TrainingScreen's content style).
    paddingBottom: 72 + spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  langRow: {
    flexDirection: "row",
    gap: 4,
  },
  langChip: {
    minWidth: 32,
    minHeight: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tileWrap: {
    minWidth: "47%",
    flexGrow: 1,
  },
  actionTile: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  assistantCard: {
    gap: spacing.xs,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  messageRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    flex: 1,
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: 4,
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
