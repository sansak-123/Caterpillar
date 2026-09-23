using UnityEngine;
using UnityEngine.AI;

namespace OperatorSim
{
    /// <summary>
    /// A NavMesh-driven worker patrolling between waypoints — CLAUDE.md Phase 7. Some
    /// patrol routes are deliberately placed (in the Editor, by positioning
    /// <see cref="patrolPoints"/>) to cross the machine's rear blind spot, which is
    /// what makes the `TrenchNearWorkers` scenario meaningful. This script only
    /// handles movement; ProximityZones.cs measures distance from these workers to the
    /// machine and raises breach events.
    ///
    /// Editor setup: bake a NavMesh for the scenario terrain (Window > AI > Navigation
    /// > Bake), add a NavMeshAgent to this GameObject, and assign 2+ patrolPoints —
    /// at least one behind the machine's rear pivot for the blind-spot scenarios.
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public class WorkerAgent : MonoBehaviour
    {
        [SerializeField] private Transform[] patrolPoints;
        [SerializeField] private float waypointTolerance = 0.5f;
        [SerializeField] private float pauseAtWaypointS = 1.5f;

        private NavMeshAgent _agent;
        private int _targetIndex;
        private float _pauseTimer;
        private bool _paused;

        public Vector3 WorldPosition => transform.position;

        private void Awake()
        {
            _agent = GetComponent<NavMeshAgent>();
        }

        private void Start()
        {
            if (patrolPoints != null && patrolPoints.Length > 0)
            {
                _agent.SetDestination(patrolPoints[0].position);
            }
        }

        private void Update()
        {
            if (patrolPoints == null || patrolPoints.Length == 0) return;

            if (_paused)
            {
                _pauseTimer -= Time.deltaTime;
                if (_pauseTimer <= 0f)
                {
                    _paused = false;
                    _targetIndex = (_targetIndex + 1) % patrolPoints.Length;
                    _agent.SetDestination(patrolPoints[_targetIndex].position);
                }
                return;
            }

            if (!_agent.pathPending && _agent.remainingDistance <= waypointTolerance)
            {
                _paused = true;
                _pauseTimer = pauseAtWaypointS;
            }
        }
    }
}
