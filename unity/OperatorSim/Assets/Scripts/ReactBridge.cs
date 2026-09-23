using System.Runtime.InteropServices;
using UnityEngine;

namespace OperatorSim
{
    /// <summary>
    /// The one seam between React Native and Unity — CLAUDE.md section 3.0's two-tier
    /// plan. This GameObject MUST be named exactly "Bridge" in the scene: every native
    /// Unity-embedding library for RN (and the WebGL fallback below) delivers messages
    /// via Unity's own `UnitySendMessage(gameObjectName, methodName, jsonArg)`
    /// primitive, so the receiving methods here are the entire contract — React only
    /// ever needs to know these four method names, never Unity internals.
    ///
    /// Native tier: whichever RN-Unity bridge library ends up chosen (CLAUDE.md
    /// section 3.0 names react-native-unity-view / @azesmway/react-native-unity as
    /// candidates) delivers messages here automatically via UnitySendMessage — no
    /// extra native-side wiring needed for *receiving*. For *sending* score/event data
    /// back to React, fill in <see cref="SendToNative"/> with that library's specific
    /// call (they differ: some expose a static UnityMessageManager.SendMessageToRN,
    /// others a different API) — this is the one native-tier integration point that
    /// depends on which library is actually installed in mobile/, so it can't be
    /// written generically here.
    ///
    /// WebGL fallback tier: Bridge.jslib (Assets/Plugins/WebGL/Bridge.jslib) posts
    /// window messages that react-native-webview's onMessage picks up, and
    /// SendToNative below calls into it via the DllImport when running in a WebGL
    /// build (react-native-webview's injected JS calls back into
    /// `window.unityInstance.SendMessage("Bridge", ...)`, which is this same
    /// UnitySendMessage primitive, just routed through the browser).
    /// </summary>
    public class ReactBridge : MonoBehaviour
    {
        private const string RequiredGameObjectName = "Bridge";

        [SerializeField] private ScenarioManager scenarioManager;

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void Bridge_SendToReactNative(string json);
#endif

        private void Awake()
        {
            if (gameObject.name != RequiredGameObjectName)
            {
                Debug.LogError(
                    $"[ReactBridge] This GameObject must be named '{RequiredGameObjectName}' — " +
                    "native UnitySendMessage calls and Bridge.jslib both target that exact name.");
            }
            scenarioManager.OnScenarioComplete += result => SendToNative(JsonUtility.ToJson(result));
        }

        // ---- Inbound: called by native UnitySendMessage / Bridge.jslib ----

        public void LoadScenario(string configJson) => scenarioManager.LoadScenario(configJson);

        public void ApplyTelemetry(string telemetryJson) => scenarioManager.ApplyLiveTelemetry(telemetryJson);

        public void EndScenario(string _unused) => scenarioManager.EndScenario();

        // ---- Outbound: Unity -> React Native ----

        private void SendToNative(string json)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            Bridge_SendToReactNative(json);
#elif UNITY_ANDROID || UNITY_IOS
            // Fill in with the chosen native bridge library's send call, e.g. (for a
            // UnityMessageManager-style library):
            //   UnityMessageManager.Instance.SendMessageToRN(json);
            Debug.Log($"[ReactBridge] (native send not yet wired to a specific library) {json}");
#else
            Debug.Log($"[ReactBridge] (editor testing, no RN host) {json}");
#endif
        }
    }
}
