using System;

namespace OperatorSim
{
    /// <summary>
    /// JSON data contracts exchanged between React Native and Unity (CLAUDE.md section
    /// 3.0/6). Every message crossing the bridge — native UnityMessageManager or the
    /// WebGL fallback's postMessage channel — is one of these, serialized with
    /// JsonUtility. Field names are camelCase to match what the RN/TypeScript side
    /// naturally produces from JSON.stringify; JsonUtility requires exact field-name
    /// matches (no attributes needed as long as casing lines up).
    /// </summary>
    [Serializable]
    public class CycleFrame
    {
        public float t;
        public float boomDeg;
        public float stickDeg;
        public float bucketDeg;
        public float swingDeg;
        public string phase; // dig / swing_load / dump / swing_return
        public float hydraulicPressureBar;
        public float payloadKg;
        public float fuelBurnL;
    }

    [Serializable]
    public class GhostTrace
    {
        public string cycleId;
        public string operatorId;
        public string skill;
        public CycleFrame[] frames;
    }

    /// <summary>Wrapper class purely so JsonUtility (which can't deserialize a bare
    /// top-level array) can parse a JSON array of frames sent as {"frames": [...]}.</summary>
    [Serializable]
    public class CycleFrameList
    {
        public CycleFrame[] frames;
    }

    [Serializable]
    public class ConditionConfig
    {
        public float visibilityM = 10000f;
        public float precipMm;
        public float windKmh = 5f;
    }

    [Serializable]
    public class ScenarioConfig
    {
        public string scenario; // TrenchNearWorkers / LoadingInRain / IdleDiscipline / GhostOperator / NearMissReplay
        public string machineClass = "excavator"; // excavator / wheel_loader / dozer
        public ConditionConfig conditions;
        public string ghostTraceJson; // populated for GhostOperator (a GhostTrace, JSON-encoded)
        public string eventJson; // populated for NearMissReplay (a NearMissReplayEvent, JSON-encoded)
    }

    [Serializable]
    public class WorkerPosition
    {
        public string id;
        public float x;
        public float y;
        public float z;
        public float atSeconds;
    }

    [Serializable]
    public class WorkerPath
    {
        public WorkerPosition[] points;
    }

    [Serializable]
    public class NearMissReplayEvent
    {
        public string incidentId;
        public string trigger; // red_zone_swing / red_zone_reverse / belt_off_travel
        public WorkerPosition[] workerPath;
        public CycleFrame[] machineTrace;
    }

    [Serializable]
    public class GhostComparison
    {
        public float cycleTimeDeltaS;
        public float smoothnessDeltaPct;
        public float fuelDeltaL;
    }

    [Serializable]
    public class ScoreResult
    {
        public string scenario;
        public float cycleTimeS;
        public float smoothnessJerk; // lower is smoother; see Scoring.cs
        public float idleS;
        public int zoneBreaches;
        public float fuelEstimateL;
        public bool hasGhostComparison;
        public GhostComparison comparedToGhost;
    }

    [Serializable]
    public class ProximityBreachEvent
    {
        public string zone; // amber / red
        public string sector; // front / rear
        public float distanceM;
        public bool isSwinging;
        public bool isReversing;
    }

    /// <summary>Live telemetry frame used by TelemetryDriver's LiveTwin mode — a subset
    /// of telemetry_1min.parquet's columns (CLAUDE.md section 5.1), only what's needed
    /// to animate the rig and evaluate proximity/seatbelt state.</summary>
    [Serializable]
    public class LiveTelemetryFrame
    {
        public float boomDeg;
        public float stickDeg;
        public float bucketDeg;
        public float swingDeg;
        public float travelKmh;
        public bool reverse;
        public string seatbelt; // Fastened / Unfastened
        public float nearestPersonM;
        public string zone; // green / amber / red
    }
}
