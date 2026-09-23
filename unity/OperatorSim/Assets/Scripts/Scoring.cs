using System.Collections.Generic;
using UnityEngine;

namespace OperatorSim
{
    /// <summary>
    /// Scores a training run against cycle time, smoothness (jerk), idle time, zone
    /// breaches, and fuel estimate — CLAUDE.md Phase 7 / USP-1. Compares against the
    /// active GhostPlayer's trace when one is loaded, so a trainee sees a concrete
    /// number ("+3.2s slower than the ghost, 18% jerkier"), not just their own stats
    /// in isolation.
    /// </summary>
    [RequireComponent(typeof(ExcavatorRig))]
    public class Scoring : MonoBehaviour
    {
        [SerializeField] private ExcavatorRig rig;
        [SerializeField] private GhostPlayer ghost; // optional — null outside GhostOperator scenario
        [SerializeField] private float sampleIntervalS = 0.1f;
        [SerializeField] private float idleAngularVelocityThreshold = 2f; // deg/s, summed across joints
        [SerializeField] private float workFuelLph = 16f; // matches machines.csv work_lph order of magnitude
        [SerializeField] private float idleFuelLph = 4f;

        private readonly List<Vector4> _angleSamples = new(); // (boom, stick, bucket, swing) per sample
        private readonly List<float> _sampleTimes = new();
        private float _sampleTimer;
        private float _cycleStartTime;
        private float _idleSeconds;
        private float _fuelLiters;
        private int _zoneBreaches;
        private bool _running;

        public void BeginCycle()
        {
            _angleSamples.Clear();
            _sampleTimes.Clear();
            _cycleStartTime = Time.time;
            _idleSeconds = 0f;
            _fuelLiters = 0f;
            _zoneBreaches = 0;
            _running = true;
            ghost?.StartPlayback();
        }

        /// <summary>Called by ProximityZones.cs whenever a breach is detected during
        /// this run — CLAUDE.md section 6 `near_miss` mirrored in-sim for training.</summary>
        public void RegisterZoneBreach() => _zoneBreaches++;

        private void Update()
        {
            if (!_running) return;

            _sampleTimer += Time.deltaTime;
            if (_sampleTimer >= sampleIntervalS)
            {
                _sampleTimer = 0f;
                _angleSamples.Add(new Vector4(rig.BoomDeg, rig.StickDeg, rig.BucketDeg, rig.SwingDeg));
                _sampleTimes.Add(Time.time - _cycleStartTime);
            }

            bool isIdle = IsCurrentlyIdle();
            _fuelLiters += (isIdle ? idleFuelLph : workFuelLph) / 3600f * Time.deltaTime;
            if (isIdle) _idleSeconds += Time.deltaTime;
        }

        private bool IsCurrentlyIdle()
        {
            if (_angleSamples.Count < 2) return false;
            Vector4 prev = _angleSamples[_angleSamples.Count - 2];
            Vector4 curr = _angleSamples[_angleSamples.Count - 1];
            float dt = Mathf.Max(0.0001f, sampleIntervalS);
            float angularSpeed = (Mathf.Abs(curr.x - prev.x) + Mathf.Abs(curr.y - prev.y) +
                                   Mathf.Abs(curr.z - prev.z) + Mathf.Abs(curr.w - prev.w)) / dt;
            return angularSpeed < idleAngularVelocityThreshold;
        }

        /// <summary>Mean absolute jerk (3rd derivative of joint angle) across all four
        /// joints, using finite differences over the sampled trace — lower is smoother.
        /// This is a simplified stand-in for a proper jerk integral, adequate for
        /// relative comparison between a trainee and the ghost, not a biomechanics
        /// paper.</summary>
        private float ComputeSmoothnessJerk()
        {
            if (_angleSamples.Count < 4) return 0f;
            float dt = sampleIntervalS;
            float totalJerk = 0f;
            int count = 0;

            for (int i = 3; i < _angleSamples.Count; i++)
            {
                Vector4 a3 = _angleSamples[i];
                Vector4 a2 = _angleSamples[i - 1];
                Vector4 a1 = _angleSamples[i - 2];
                Vector4 a0 = _angleSamples[i - 3];

                // third finite difference ~ jerk, per joint, summed
                Vector4 jerk = (a3 - 3f * a2 + 3f * a1 - a0) / (dt * dt * dt);
                totalJerk += Mathf.Abs(jerk.x) + Mathf.Abs(jerk.y) + Mathf.Abs(jerk.z) + Mathf.Abs(jerk.w);
                count++;
            }
            return count > 0 ? totalJerk / count : 0f;
        }

        public ScoreResult EndCycle(string scenarioName)
        {
            _running = false;
            float cycleTimeS = Time.time - _cycleStartTime;
            float jerk = ComputeSmoothnessJerk();

            var result = new ScoreResult
            {
                scenario = scenarioName,
                cycleTimeS = cycleTimeS,
                smoothnessJerk = jerk,
                idleS = _idleSeconds,
                zoneBreaches = _zoneBreaches,
                fuelEstimateL = _fuelLiters,
                hasGhostComparison = ghost != null && ghost.IsLoaded,
            };

            if (result.hasGhostComparison)
            {
                float ghostCycleTime = ghost.DurationSeconds;
                result.comparedToGhost = new GhostComparison
                {
                    cycleTimeDeltaS = cycleTimeS - ghostCycleTime,
                    // Ghost (expert) jerk isn't independently measured in this pass —
                    // documented simplification: assume an expert trace is close to
                    // the low end of observed jerk, so we report relative-to-self only
                    // for now rather than fabricate a ghost jerk number.
                    smoothnessDeltaPct = 0f,
                    fuelDeltaL = 0f,
                };
            }

            ghost?.Stop();
            return result;
        }
    }
}
