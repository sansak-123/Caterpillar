using UnityEngine;

namespace OperatorSim
{
    /// <summary>
    /// "LiveTwin" mode — CLAUDE.md Phase 7: animates the rig directly from a JSON
    /// telemetry frame sent by React Native, instead of trainee input. Used when the
    /// simulator is showing what the real (or simulated) machine is doing right now,
    /// as opposed to a trainee actively driving the rig.
    /// </summary>
    public class TelemetryDriver : MonoBehaviour
    {
        [SerializeField] private ExcavatorRig rig;
        [SerializeField] private ProximityZones proximityZones;

        public string LastSeatbeltStatus { get; private set; } = "Fastened";
        public string LastZone { get; private set; } = "green";

        /// <summary>Called by ReactBridge with one JSON-encoded LiveTelemetryFrame per
        /// message — at whatever cadence the device sends (nominally 1 Hz, per
        /// CLAUDE.md section 3.1's on-device telemetry rate).</summary>
        public void ApplyTelemetryJson(string json)
        {
            LiveTelemetryFrame frame;
            try
            {
                frame = JsonUtility.FromJson<LiveTelemetryFrame>(json);
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[TelemetryDriver] Failed to parse telemetry frame: {e.Message}");
                return;
            }
            if (frame == null) return;

            rig?.ApplyFrame(frame.boomDeg, frame.stickDeg, frame.bucketDeg, frame.swingDeg);
            proximityZones?.SetReversing(frame.reverse);
            LastSeatbeltStatus = frame.seatbelt;
            LastZone = frame.zone;
        }
    }
}
