using UnityEngine;

namespace OperatorSim
{
    /// <summary>
    /// Replays a confirmed near-miss — CLAUDE.md USP-2 "every near-miss becomes a
    /// lesson": moves a worker transform along the exact recorded path
    /// (NearMissReplayEvent.workerPath) and, if the event carries a machine trace,
    /// drives the rig through the same joint motion that was live when the near-miss
    /// happened. Both are keyed by `atSeconds` from the event start.
    ///
    /// Editor setup: assign a worker prefab instance's Transform as
    /// <see cref="workerTransform"/> (reuse one of the scenario's WorkerAgent
    /// GameObjects, but disable its NavMeshAgent/WorkerAgent script while a replay is
    /// active so this script has sole control of its position).
    /// </summary>
    public class NearMissReplayMover : MonoBehaviour
    {
        [SerializeField] private Transform workerTransform;
        [SerializeField] private ExcavatorRig rig;

        private NearMissReplayEvent _event;
        private float _startTime = -1f;

        public void LoadEvent(NearMissReplayEvent replayEvent)
        {
            _event = replayEvent;
        }

        public void Play()
        {
            _startTime = Time.time;
        }

        public void Stop()
        {
            _startTime = -1f;
        }

        private void Update()
        {
            if (_event == null || _startTime < 0f) return;
            float elapsed = Time.time - _startTime;

            if (workerTransform != null && _event.workerPath is { Length: > 0 })
            {
                Vector3 pos = SampleWorkerPath(elapsed);
                workerTransform.position = pos;
            }

            if (rig != null && _event.machineTrace is { Length: > 0 })
            {
                CycleFrame frame = SampleMachineTrace(elapsed);
                rig.ApplyFrame(frame.boomDeg, frame.stickDeg, frame.bucketDeg, frame.swingDeg);
            }

            float duration = Mathf.Max(
                _event.workerPath is { Length: > 0 } ? _event.workerPath[^1].atSeconds : 0f,
                _event.machineTrace is { Length: > 0 } ? _event.machineTrace[^1].t : 0f);
            if (elapsed > duration) Stop();
        }

        private Vector3 SampleWorkerPath(float t)
        {
            var path = _event.workerPath;
            if (path.Length == 1) return new Vector3(path[0].x, path[0].y, path[0].z);

            int hi = 1;
            while (hi < path.Length - 1 && path[hi].atSeconds < t) hi++;
            int lo = hi - 1;
            float span = Mathf.Max(0.0001f, path[hi].atSeconds - path[lo].atSeconds);
            float lerpT = Mathf.Clamp01((t - path[lo].atSeconds) / span);

            return Vector3.Lerp(
                new Vector3(path[lo].x, path[lo].y, path[lo].z),
                new Vector3(path[hi].x, path[hi].y, path[hi].z),
                lerpT);
        }

        private CycleFrame SampleMachineTrace(float t)
        {
            var frames = _event.machineTrace;
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
            };
        }
    }
}
