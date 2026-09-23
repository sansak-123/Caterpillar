using System.Collections;
using UnityEngine;

namespace OperatorSim
{
    /// <summary>
    /// Top-level scenario lifecycle — CLAUDE.md section 6 "Training hub": loads one of
    /// TrenchNearWorkers / LoadingInRain / IdleDiscipline / GhostOperator /
    /// NearMissReplay(event_json), wires up conditions/ghost/replay data, and reports
    /// a ScoreResult at the end. This is the single entry point ReactBridge calls into
    /// — React only ever talks to ScenarioManager, never the individual subsystems
    /// directly, so the bridge contract stays small and stable even as scenarios grow.
    /// </summary>
    public class ScenarioManager : MonoBehaviour
    {
        [SerializeField] private ExcavatorRig rig;
        [SerializeField] private Scoring scoring;
        [SerializeField] private GhostPlayer ghostPlayer;
        [SerializeField] private ProximityZones proximityZones;
        [SerializeField] private WeatherFX weatherFx;
        [SerializeField] private TelemetryDriver telemetryDriver;
        [SerializeField] private NearMissReplayMover replayMover; // see NearMissReplayMover.cs

        private string _activeScenario;

        public event System.Action<ScoreResult> OnScenarioComplete;

        public void LoadScenario(string configJson)
        {
            ScenarioConfig config;
            try
            {
                config = JsonUtility.FromJson<ScenarioConfig>(configJson);
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[ScenarioManager] Bad scenario config JSON: {e.Message}");
                return;
            }
            if (config == null) return;

            _activeScenario = config.scenario;
            weatherFx?.ApplyConditions(config.conditions);
            proximityZones?.SetConditions(config.conditions);

            switch (config.scenario)
            {
                case "GhostOperator":
                    if (!string.IsNullOrEmpty(config.ghostTraceJson))
                        ghostPlayer?.LoadTrace(config.ghostTraceJson);
                    break;

                case "NearMissReplay":
                    if (!string.IsNullOrEmpty(config.eventJson))
                    {
                        var replayEvent = JsonUtility.FromJson<NearMissReplayEvent>(config.eventJson);
                        replayMover?.LoadEvent(replayEvent);
                    }
                    break;

                case "TrenchNearWorkers":
                case "LoadingInRain":
                case "IdleDiscipline":
                    // These scenarios use the scene's pre-placed WorkerAgent patrol
                    // routes and standard trainee input — no extra data to load beyond
                    // conditions, already applied above.
                    break;

                default:
                    Debug.LogWarning($"[ScenarioManager] Unknown scenario '{config.scenario}'");
                    break;
            }

            StartScenario();
        }

        private void StartScenario()
        {
            scoring?.BeginCycle();
            if (_activeScenario == "NearMissReplay") replayMover?.Play();
        }

        /// <summary>Called by ReactBridge when the trainee/presenter ends the run (or
        /// automatically when a fixed-duration scenario like NearMissReplay finishes).</summary>
        public void EndScenario()
        {
            if (scoring == null) return;
            ScoreResult result = scoring.EndCycle(_activeScenario);
            OnScenarioComplete?.Invoke(result);
        }

        public void ApplyLiveTelemetry(string telemetryJson) => telemetryDriver?.ApplyTelemetryJson(telemetryJson);
    }
}
