// Native version (Android/iOS): Unity WebGL build inside a WebView (CLAUDE.md §3.0 fallback tier).
// Needs: npx expo install react-native-webview
import { forwardRef, useImperativeHandle, useRef } from "react";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { NATIVE_SIM_URL, parseSimMessage, type SimCommand, type UnitySimHandle, type UnitySimProps } from "../lib/unity/bridge";

const UnitySim = forwardRef<UnitySimHandle, UnitySimProps>(function UnitySim({ onMessage }, ref) {
  const web = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    send(cmd: SimCommand) {
      // Posts inside the page; the SiteSim template's "message" listener forwards it to Unity.
      const payload = JSON.stringify({ target: "unity-sim", ...cmd });
      web.current?.injectJavaScript(`window.postMessage(${payload}, "*"); true;`);
    },
  }), []);

  const handle = (e: WebViewMessageEvent) => {
    try {
      const msg = parseSimMessage(JSON.parse(e.nativeEvent.data));
      if (msg) onMessage(msg);
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <WebView
      ref={web}
      source={{ uri: NATIVE_SIM_URL }}
      originWhitelist={["*"]}
      javaScriptEnabled
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      onMessage={handle}
      style={{ flex: 1, backgroundColor: "#2a2d30" }}
    />
  );
});

export default UnitySim;
export { UnitySim };