using UnityEngine;

namespace OperatorSim
{
    /// <summary>
    /// Loads an expert's recorded cycle trace (from ml/task_time's cycle_traces.parquet,
    /// exported to JSON by the backend/registry) and replays it on a translucent
    /// duplicate rig alongside the trainee — CLAUDE.md USP-1 Ghost Operator. Playback
    /// is driven by wall-clock time since <see cref="StartPlayback"/>, interpolating
    /// between the two nearest recorded frames so a ~1-frame/second trace still looks
    /// smooth at 60 fps.
    ///
    /// Editor setup: duplicate the excavator rig prefab, assign it here as
    /// <see cref="ghostRig"/>, and put a semi-transparent material (alpha ~0.35, a
    /// cool blue tint reads well against the CAT-yellow real rig) on its renderers.
    /// </summary>
    public class GhostPlayer : MonoBehaviour
    {
        [SerializeField] private ExcavatorRig ghostRig;
        [SerializeField] private bool loop = true;

        private GhostTrace _trace;
        private float _playbackStartTime = -1f;

        public bool IsLoaded => _trace != null && _trace.frames != null && _trace.frames.Length > 0;
        public float DurationSeconds => IsLoaded ? _trace.frames[_trace.frames.Length - 1].t : 0f;
        public string Skill => _trace?.skill;

        /// <summary>Accepts either a bare GhostTrace JSON object, or one wrapped as
        /// {"frames": [...]} if only the frame list was sent (see CycleFrameList).</summary>
        public bool LoadTrace(string json)
        {
            try
            {
                var trace = JsonUtility.FromJson<GhostTrace>(json);
                if (trace?.frames == null || trace.frames.Length == 0)
                {
                    var wrapped = JsonUtility.FromJson<CycleFrameList>(json);
                    if (wrapped?.frames == null || wrapped.frames.Length == 0) return false;
                    trace = new GhostTrace { frames = wrapped.frames, cycleId = "unknown", skill = "Expert" };
                }
                _trace = trace;
                return true;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[GhostPlayer] Failed to parse ghost trace JSON: {e.Message}");
                return false;
            }
        }

        /// <summary>Starts the ghost in sync with the trainee's own cycle start —
        /// called by ScenarioManager the moment the trainee begins a dig cycle, so the
        /// comparison in Scoring.cs is apples-to-apples.</summary>
        public void StartPlayback()
        {
            _playbackStartTime = Time.time;
            if (ghostRig != null) gameObject.SetActive(true);
        }

        public void Stop()
        {
            _playbackStartTime = -1f;
            if (ghostRig != null) gameObject.SetActive(false);
        }

        private void Update()
        {
            if (!IsLoaded || _playbackStartTime < 0f || ghostRig == null) return;

            float elapsed = Time.time - _playbackStartTime;
            float duration = DurationSeconds;
            if (duration <= 0f) return;

            if (elapsed > duration)
            {
                if (!loop) { Stop(); return; }
                elapsed %= duration;
                _playbackStartTime = Time.time - elapsed;
            }

            CycleFrame frame = SampleAt(elapsed);
            ghostRig.ApplyFrame(frame.boomDeg, frame.stickDeg, frame.bucketDeg, frame.swingDeg);
        }

        private CycleFrame SampleAt(float t)
        {
            var frames = _trace.frames;
            if (frames.Length == 1) return frames[0];

            int hi = 1;
            while (hi < frames.Length - 1 && frames[hi].t < t) hi++;
            int lo = hi - 1;

            float span = Mathf.Max(0.0001f, frames[hi].t - frames[lo].t);
            float lerpT = Mathf.Clamp01((t - frames[lo].t) / span);

            return new CycleFrame
            {
                t = t,
                boomDeg = Mathf.Lerp(frames[lo].boomDeg, frames[hi].boomDeg, lerpT),
                stickDeg = Mathf.Lerp(frames[lo].stickDeg, frames[hi].stickDeg, lerpT),
                bucketDeg = Mathf.Lerp(frames[lo].bucketDeg, frames[hi].bucketDeg, lerpT),
                swingDeg = Mathf.Lerp(frames[lo].swingDeg, frames[hi].swingDeg, lerpT),
                phase = frames[lo].phase,
                hydraulicPressureBar = Mathf.Lerp(frames[lo].hydraulicPressureBar, frames[hi].hydraulicPressureBar, lerpT),
                payloadKg = Mathf.Lerp(frames[lo].payloadKg, frames[hi].payloadKg, lerpT),
                fuelBurnL = Mathf.Lerp(frames[lo].fuelBurnL, frames[hi].fuelBurnL, lerpT),
            };
        }
    }
}
