// WebGL fallback tier (CLAUDE.md section 3.0) — pairs with ReactBridge.cs's
// Bridge_SendToReactNative DllImport. Posts a window message that the host page
// (loaded inside a react-native-webview) forwards to React Native via
// `window.ReactNativeWebView.postMessage(...)`, mirroring the same
// postMessage/onMessage pattern react-unity-webgl uses on the plain web.
//
// Inbound direction (React Native -> Unity) doesn't need anything here: the WebView
// host page's injected JavaScript calls `unityInstance.SendMessage("Bridge", methodName,
// jsonArg)` directly — the standard Unity WebGL JS API — which arrives at ReactBridge.cs
// exactly like a native UnitySendMessage call does.

mergeInto(LibraryManager.library, {
  Bridge_SendToReactNative: function (jsonPtr) {
    var json = UTF8ToString(jsonPtr);
    if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
      window.ReactNativeWebView.postMessage(json);
    } else if (window.parent) {
      // Fallback for testing the WebGL build directly in a browser tab (no WebView host).
      window.parent.postMessage(json, "*");
    } else {
      console.log("[Bridge.jslib] no RN WebView host found, message dropped:", json);
    }
  },
});
