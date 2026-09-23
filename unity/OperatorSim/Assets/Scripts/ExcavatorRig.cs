using UnityEngine;

namespace OperatorSim
{
    public enum ControlPattern { ISO, SAE }

    /// <summary>
    /// Drives the boom/stick/bucket/swing joints of the excavator rig — CLAUDE.md
    /// Phase 7. Accepts keyboard input (desktop testing in the Editor) and virtual
    /// axes from an on-screen touch joystick (wired in the Editor to call
    /// <see cref="SetVirtualAxis"/> — see unity/README.md's Editor checklist for the
    /// touch joystick prefab setup, which is Editor/UI work this script can't do on
    /// its own).
    ///
    /// Editor setup required (see the Editor checklist): assign the four pivot
    /// Transforms in the Inspector, and create four Input Manager axes named "Boom",
    /// "Stick", "Bucket", "Swing" (Edit > Project Settings > Input Manager) bound to
    /// whatever keys/gamepad you want for desktop testing.
    /// </summary>
    public class ExcavatorRig : MonoBehaviour
    {
        [Header("Joint pivots (assign in Inspector)")]
        [SerializeField] private Transform swingPivot;
        [SerializeField] private Transform boomPivot;
        [SerializeField] private Transform stickPivot;
        [SerializeField] private Transform bucketPivot;

        [Header("Angle limits (degrees)")]
        [SerializeField] private Vector2 boomLimits = new Vector2(5f, 65f);
        [SerializeField] private Vector2 stickLimits = new Vector2(10f, 120f);
        [SerializeField] private Vector2 bucketLimits = new Vector2(10f, 100f);
        [SerializeField] private Vector2 swingLimits = new Vector2(-95f, 95f);

        [Header("Speeds (degrees/second at full input)")]
        [SerializeField] private float boomSpeed = 25f;
        [SerializeField] private float stickSpeed = 30f;
        [SerializeField] private float bucketSpeed = 40f;
        [SerializeField] private float swingSpeed = 35f;

        [SerializeField] private ControlPattern controlPattern = ControlPattern.SAE;

        // Current joint state — read by Scoring.cs / TelemetryDriver.cs for cycle
        // capture and comparison against a ghost trace.
        public float BoomDeg { get; private set; }
        public float StickDeg { get; private set; }
        public float BucketDeg { get; private set; }
        public float SwingDeg { get; private set; }

        // Overridden by SetVirtualAxis when a touch joystick is driving input;
        // keyboard axes are read every frame as a fallback for desktop testing.
        private readonly System.Collections.Generic.Dictionary<string, float> _virtualAxes =
            new System.Collections.Generic.Dictionary<string, float>
            {
                { "Boom", 0f }, { "Stick", 0f }, { "Bucket", 0f }, { "Swing", 0f },
            };
        private bool _usingVirtualInput;

        public void SetControlPattern(ControlPattern pattern) => controlPattern = pattern;

        /// <summary>Called by the on-screen touch joystick UI (built in the Editor) —
        /// e.g. SetVirtualAxis("Boom", 0.8f) each frame while the joystick is held.</summary>
        public void SetVirtualAxis(string axisName, float value)
        {
            _virtualAxes[axisName] = Mathf.Clamp(value, -1f, 1f);
            _usingVirtualInput = true;
        }

        private void Start()
        {
            BoomDeg = boomPivot != null ? boomLimits.x : 0f;
            StickDeg = stickPivot != null ? stickLimits.x : 0f;
            BucketDeg = bucketPivot != null ? bucketLimits.x : 0f;
            SwingDeg = 0f;
        }

        private void Update()
        {
            float boomIn = ReadAxis("Boom");
            float stickIn = ReadAxis("Stick");
            float bucketIn = ReadAxis("Bucket");
            float swingIn = ReadAxis("Swing");

            // ISO swaps which lever controls stick/swing vs boom/bucket relative to
            // SAE — a real, well-known operator-training distinction (CLAUDE.md
            // operators.csv tracks preferred_control_pattern per operator for exactly
            // this reason). Not safety-critical to get pixel-perfect for a hackathon
            // sim, but worth being genuine about.
            if (controlPattern == ControlPattern.ISO)
            {
                (stickIn, swingIn) = (swingIn, stickIn);
            }

            BoomDeg = Mathf.Clamp(BoomDeg + boomIn * boomSpeed * Time.deltaTime, boomLimits.x, boomLimits.y);
            StickDeg = Mathf.Clamp(StickDeg + stickIn * stickSpeed * Time.deltaTime, stickLimits.x, stickLimits.y);
            BucketDeg = Mathf.Clamp(BucketDeg + bucketIn * bucketSpeed * Time.deltaTime, bucketLimits.x, bucketLimits.y);
            SwingDeg = Mathf.Clamp(SwingDeg + swingIn * swingSpeed * Time.deltaTime, swingLimits.x, swingLimits.y);

            ApplyPose();
        }

        private float ReadAxis(string axisName)
        {
            if (_usingVirtualInput) return _virtualAxes[axisName];
            try { return Input.GetAxis(axisName); }
            catch (System.Exception) { return 0f; } // axis not configured in Input Manager yet
        }

        private void ApplyPose()
        {
            if (boomPivot != null) boomPivot.localRotation = Quaternion.Euler(-BoomDeg, 0f, 0f);
            if (stickPivot != null) stickPivot.localRotation = Quaternion.Euler(StickDeg, 0f, 0f);
            if (bucketPivot != null) bucketPivot.localRotation = Quaternion.Euler(BucketDeg, 0f, 0f);
            if (swingPivot != null) swingPivot.localRotation = Quaternion.Euler(0f, SwingDeg, 0f);
        }

        /// <summary>Snapshot of the current pose, matching the CycleFrame contract so
        /// Scoring.cs and TelemetryDriver.cs can both consume it uniformly.</summary>
        public CycleFrame CaptureFrame(float t, string phase, float hydraulicPressureBar, float payloadKg, float fuelBurnL)
        {
            return new CycleFrame
            {
                t = t,
                boomDeg = BoomDeg,
                stickDeg = StickDeg,
                bucketDeg = BucketDeg,
                swingDeg = SwingDeg,
                phase = phase,
                hydraulicPressureBar = hydraulicPressureBar,
                payloadKg = payloadKg,
                fuelBurnL = fuelBurnL,
            };
        }

        /// <summary>Directly sets the pose from a recorded/live frame — used by
        /// TelemetryDriver (LiveTwin mode) and GhostPlayer (ghost replay), which drive
        /// the rig from data instead of live input.</summary>
        public void ApplyFrame(float boomDeg, float stickDeg, float bucketDeg, float swingDeg)
        {
            BoomDeg = Mathf.Clamp(boomDeg, boomLimits.x, boomLimits.y);
            StickDeg = Mathf.Clamp(stickDeg, stickLimits.x, stickLimits.y);
            BucketDeg = Mathf.Clamp(bucketDeg, bucketLimits.x, bucketLimits.y);
            SwingDeg = Mathf.Clamp(swingDeg, swingLimits.x, swingLimits.y);
            ApplyPose();
        }
    }
}
