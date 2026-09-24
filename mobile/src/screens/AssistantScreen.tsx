import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ArrowRightIcon, BookIcon, ChatIcon, HazardIcon, MicIcon, PulseIcon, ShieldIcon, StopIcon, UserIcon } from "../components/icons";
import { Badge } from "../components/Badge";
import { Page } from "../components/Page";
import { type ChatMessage, useAssistant } from "../lib/assistant/useAssistant";
import { useVoiceInput, type AssistantLanguage } from "../lib/assistant/voice";
import { useLanguageStore } from "../store/language";
import { useColors } from "../theme/useColors";
import { radius, spacing, touchTarget, type } from "../theme/tokens";

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

  const quickIcon: Record<string, (c: string) => React.ReactNode> = {
    explain_estimate: (c) => <PulseIcon color={c} size={15} />,
    safety_question: (c) => <ShieldIcon color={c} size={15} />,
    log_incident: (c) => <HazardIcon color={c} size={15} />,
    book_instructor: (c) => <UserIcon color={c} size={15} />,
  };

  return (
    <Page
      eyebrow="Assistant"
      title="How can I help?"
      subtitle={
        isOnline
          ? "Online — answers use the OpenRouter assistant model, grounded in your real tasks and flags."
          : "Offline — answering from the on-device safety knowledge base only."
      }
      scroll={false}
      right={
        <View style={styles.headerRight}>
          <Badge label={isOnline ? "Online model" : "Offline KB"} tone={isOnline ? "safe" : "caution"} />
          <View style={[styles.langRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${l.label}`}
                onPress={() => setLanguage(l.code)}
                style={[styles.langChip, { backgroundColor: l.code === language ? colors.accent : "transparent" }]}
              >
                <Text
                  style={[
                    type.small,
                    { color: l.code === language ? colors.accentOn : colors.textSecondary, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
    >
      <View style={styles.quickGrid}>
        {quickActions.map((a, i) => (
          <Animated.View key={a.id} entering={FadeInDown.delay(i * 60).duration(350)} style={styles.tileWrap}>
            <Pressable
              onPress={() => runQuickAction(a.id)}
              style={({ pressed, hovered }) => [
                styles.actionTile,
                { backgroundColor: hovered ? colors.surfaceSunken : colors.surface, borderColor: colors.border },
                pressed ? { opacity: 0.75 } : null,
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: colors.accentSoft }]}>{quickIcon[a.id]?.(colors.textPrimary)}</View>
              <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold", flex: 1 }]}>{a.label}</Text>
              <ArrowRightIcon color={colors.textMuted} size={13} />
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <View style={[styles.chatPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
          <ChatIcon color={colors.textSecondary} size={15} />
          <Text style={[type.small, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>Conversation</Text>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <BookIcon color={colors.textMuted} size={20} />
              <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>
                Ask a question, tap a shortcut above, or use the mic to talk hands-free.
              </Text>
            </View>
          ) : null}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} colors={colors} />
          ))}
          {busy ? <Text style={[type.small, { color: colors.textMuted }]}>Thinking…</Text> : null}
          {voice.error ? <Text style={[type.small, { color: colors.danger }]}>{voice.error}</Text> : null}
        </ScrollView>

        <View style={[styles.inputBar, { backgroundColor: colors.surfaceSunken, borderColor: colors.borderStrong }]}>
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
            style={[styles.micButton, { backgroundColor: voice.listening ? colors.danger : colors.accent }]}
          >
            {voice.listening ? <StopIcon color="#FFFFFF" size={16} /> : <MicIcon color={colors.accentOn} size={18} />}
          </Pressable>
        </View>
      </View>
    </Page>
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
        <Text style={[type.caption, { color: colors.accentOn, lineHeight: 20 }]}>{message.text}</Text>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.messageRow}>
      <View style={[styles.avatar, { backgroundColor: colors.hero }]}>
        <ChatIcon color={colors.heroText} size={14} />
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
        <Text style={[type.caption, { color: colors.textPrimary, lineHeight: 20 }]}>{message.text}</Text>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  langRow: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  langChip: {
    minWidth: 30,
    minHeight: 28,
    borderRadius: radius.sm - 2,
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
    minWidth: "22%",
    flexBasis: 200,
    flexGrow: 1,
  },
  actionTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 4,
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  chatPanel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    gap: spacing.md - 4,
    padding: spacing.md,
  },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    borderRadius: radius.lg,
    borderBottomRightRadius: 3,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md - 2,
  },
  messageRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    alignItems: "flex-start",
    maxWidth: "88%",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    flex: 1,
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    borderTopLeftRadius: 3,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md - 2,
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    margin: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingLeft: spacing.md - 2,
    paddingRight: 6,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
