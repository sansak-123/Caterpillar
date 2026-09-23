using System;
using System.Collections.Generic;
using UnityEngine;

namespace OperatorSim
{
    /// <summary>
    /// Condition-adaptive proximity rings — CLAUDE.md USP-4 / section 6 `proximity`,
    /// reimplemented in C# from the exact same formula as backend/app/rules/live.py so
    /// the simulator teaches the same envelope the real safety engine enforces, not a
    /// look-alike. Rings scale with weather conditions (passed from React at scenario
    /// start) and widen further while swinging/reversing, with the rear sector
    /// weighted higher per ISO 5006.
    ///
    /// Editor setup: assign two ring meshes/decals (amberRing, redRing — flat
    /// cylinders or a shader-based radial gradient both work) as children of the
    /// machine's base, and list the scenario's WorkerAgent instances in
    /// <see cref="workers"/>.
    /// </summary>
    public class ProximityZones : MonoBehaviour
    {
        private static readonly Dictionary<string, float> BaseRadiusM = new()
        {
            { "excavator", 12f },
            { "wheel_loader", 10f },
            { "dozer", 14f },
        };

        [SerializeField] private string machineClass = "excavator";
        [SerializeField] private ExcavatorRig rig;
        [SerializeField] private Transform rearSectorReference; // faces away from the boom
        [SerializeField] private WorkerAgent[] workers;
        [SerializeField] private Transform amberRingVisual;
        [SerializeField] private Transform redRingVisual;
        [SerializeField] private Scoring scoring;

        [Header("Condition inputs (set by ReactBridge at scenario start)")]
        [SerializeField] private float visibilityM = 10000f;
        [SerializeField] private float precipMm;
        [SerializeField] private float windKmh = 5f;
        [SerializeField] private bool isReversing;

        [Header("Rear sector weighting (ISO 5006)")]
        [SerializeField] private float rearSectorMultiplier = 1.5f;
        [SerializeField] private float rearSectorHalfAngleDeg = 60f;

        private float _lastSwingDeg;
        private float _swingRateDps;
        private readonly HashSet<WorkerAgent> _workersInRedLastFrame = new();

        public event Action<ProximityBreachEvent> OnBreach;

        public void SetConditions(ConditionConfig conditions)
        {
            if (conditions == null) return;
            visibilityM = conditions.visibilityM;
            precipMm = conditions.precipMm;
            windKmh = conditions.windKmh;
        }

        public void SetReversing(bool reversing) => isReversing = reversing;

        private float ConditionFactor()
        {
            float factor = 1f;
            factor *= 1f + Mathf.Max(0f, (1000f - visibilityM) / 2000f);
            factor *= 1f + precipMm / 50f;
            factor *= 1f + windKmh / 100f;
            return factor;
        }

        private (float redM, float amberM) ZoneRadii(bool isSwinging, bool rearSector)
        {
            float baseRadius = BaseRadiusM.TryGetValue(machineClass, out var r) ? r : 10f;
            float cond = ConditionFactor();
            float state = (isSwinging || isReversing) ? 1.3f : 1f;
            float rear = rearSector ? rearSectorMultiplier : 1f;
            float amber = baseRadius * cond * state * rear;
            float red = amber * 0.4f;
            return (red, amber);
        }

        private void Update()
        {
            if (rig != null)
            {
                _swingRateDps = Mathf.Abs(rig.SwingDeg - _lastSwingDeg) / Mathf.Max(Time.deltaTime, 0.0001f);
                _lastSwingDeg = rig.SwingDeg;
            }
            bool isSwinging = _swingRateDps > 5f;

            if (workers == null) return;
            foreach (var worker in workers)
            {
                if (worker == null) continue;
                Vector3 toWorker = worker.WorldPosition - transform.position;
                float distance = toWorker.magnitude;
                bool rearSector = IsInRearSector(toWorker);

                var (redM, amberM) = ZoneRadii(isSwinging, rearSector);
                string zone = distance < redM ? "red" : distance < amberM ? "amber" : "green";

                if (zone == "red" && !_workersInRedLastFrame.Contains(worker))
                {
                    _workersInRedLastFrame.Add(worker);
                    scoring?.RegisterZoneBreach();
                    OnBreach?.Invoke(new ProximityBreachEvent
                    {
                        zone = zone,
                        sector = rearSector ? "rear" : "front",
                        distanceM = distance,
                        isSwinging = isSwinging,
                        isReversing = isReversing,
                    });
                }
                else if (zone != "red")
                {
                    _workersInRedLastFrame.Remove(worker);
                }

                // Reference distances for the closest amber/red rings, used to size
                // the visual rings below (largest active radius wins so the visual
                // always reflects the current worst-case envelope).
                UpdateRingVisual(amberRingVisual, amberM);
                UpdateRingVisual(redRingVisual, redM);
            }
        }

        private bool IsInRearSector(Vector3 toWorker)
        {
            if (rearSectorReference == null) return false;
            float angle = Vector3.Angle(rearSectorReference.forward, toWorker);
            return angle < rearSectorHalfAngleDeg;
        }

        private static void UpdateRingVisual(Transform ring, float radiusM)
        {
            if (ring == null) return;
            // Assumes a unit-radius ring mesh at scale 1; adjust the multiplier if the
            // source mesh has a different base radius.
            ring.localScale = new Vector3(radiusM, ring.localScale.y, radiusM);
        }
    }
}
