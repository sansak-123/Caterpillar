import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import WebView from "react-native-webview";

import { radius, spacing, type } from "../theme/tokens";
import { useColors } from "../theme/useColors";

/**
 * The one React Native component that talks to the Unity simulator — CLAUDE.md
 * section 3.0's two-tier plan. Callers never know which tier is active; both speak
 * the same {@link UnitySimHandle} API. Right now only the WebGL-fallback tier has a
 * real implementation (react-native-webview is a real, installable library); the
 * native tier needs an actual compiled Unity Android/iOS build linked via
 * `expo prebuild`, which is Editor work only a human can do (see
 * unity/OperatorSim/README.md) — until that build exists, NATIVE_TIER_AVAILABLE
 * below is the single flag to flip once it does.
 */
const NATIVE_TIER_AVAILABLE = false;
const WEBGL_BUNDLE_URI = process.env.EXPO_PUBLIC_UNITY_WEBGL_URL ?? "/unity/index.html";

export type UnityMessage =
  | { method: "LoadScenario"; arg: unknown }
  | { method: "ApplyTelemetry"; arg: unknown }
  | { method: "EndScenario"; arg?: undefined };

export type UnitySimHandle = {
  send: (message: UnityMessage) => void;
};

type Props = {
  onScore?: (result: unknown) => void;
  onError?: (message: string) => void;
};

// The loaded page (unity/OperatorSim/BuildWebGL's index.html wrapper, built by a
// human in the Unity Editor) is expected to expose this global, calling
// unityInstance.SendMessage("Bridge", method, JSON.stringify(arg)) internally — see
// ReactBridge.cs's doc comment for the full contract.
function buildInjectedSend(message: UnityMessage): string {
  const argJson = JSON.stringify("arg" in message ? message.arg : {});
  return `window.sendToUnity && window.sendToUnity(${JSON.stringify(message.method)}, ${JSON.stringify(argJson)}); true;`;
}

export const UnitySim = forwardRef<UnitySimHandle, Props>(function UnitySim({ onScore, onError }, ref) {
  const colors = useColors();
  const webviewRef = useRef<WebView>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    send: (message: UnityMessage) => {
      webviewRef.current?.injectJavaScript(buildInjectedSend(message));
    },
  }));

  if (NATIVE_TIER_AVAILABLE) {
    // Once a native Unity module is linked (react-native-unity-view or similar, per
    // CLAUDE.md section 3.0), render it here instead — same `ref`/onScore contract.
    return (
      <View style={[styles.fallback, { backgroundColor: colors.surfaceRaised }]}>
        <Text style={[type.caption, { color: colors.textMuted }]}>Native Unity tier not wired yet.</Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    // react-native-webview has no web implementation; the mobile web preview used for
    // design verification during development can't render this tier at all — that's
    // expected, not a bug (see the "Unity" row in the honest tech-stack audit).
    return (
      <View style={[styles.fallback, { backgroundColor: colors.surfaceRaised }]}>
        <Text style={[type.caption, { color: colors.textMuted }]}>
          Unity preview requires a real device/emulator build — not available in the web preview.
        </Text>
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={[styles.fallback, { backgroundColor: colors.surfaceRaised }]}>
        <Text style={[type.caption, { color: colors.textMuted }]}>
          Simulator build not found at {WEBGL_BUNDLE_URI} — build unity/OperatorSim to BuildWebGL
          and copy it into mobile/assets/unity (see unity/OperatorSim/README.md).
        </Text>
      </View>
    );
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ uri: WEBGL_BUNDLE_URI }}
      style={styles.webview}
      onError={() => setLoadFailed(true)}
      onHttpError={() => setLoadFailed(true)}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          onScore?.(data);
        } catch (e) {
          onError?.(String(e));
        }
      }}
    />
  );
});

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    borderRadius: radius.md,
  },
  fallback: {
    flex: 1,
    minHeight: 160,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
});
