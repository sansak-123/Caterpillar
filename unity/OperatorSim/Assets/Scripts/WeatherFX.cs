using UnityEngine;

namespace OperatorSim
{
    /// <summary>
    /// Rain, fog (visibility), and wind-driven dust — CLAUDE.md Phase 7. Purely
    /// visual/atmospheric; ProximityZones.cs is what actually widens the safety
    /// envelope, this script just makes the condition *feel* real to the trainee at
    /// the same time.
    ///
    /// Editor setup: add a rain ParticleSystem (a simple downward-emitting box-shaped
    /// emitter above the scene works fine) and a dust ParticleSystem near ground
    /// level, assign both here, and enable Fog under Window > Rendering > Lighting >
    /// Environment.
    /// </summary>
    public class WeatherFX : MonoBehaviour
    {
        [SerializeField] private ParticleSystem rainParticles;
        [SerializeField] private ParticleSystem dustParticles;
        [SerializeField] private float maxRainEmissionRate = 800f;
        [SerializeField] private float maxDustEmissionRate = 150f;
        [SerializeField] private float fogDensityAt1kmVisibility = 0.02f;

        public void ApplyConditions(ConditionConfig conditions)
        {
            if (conditions == null) return;

            float rainIntensity = Mathf.Clamp01(conditions.precipMm / 15f);
            SetEmissionRate(rainParticles, rainIntensity * maxRainEmissionRate);

            float windIntensity = Mathf.Clamp01(conditions.windKmh / 40f);
            // Dust kicks up with wind but is suppressed once the ground is wet enough
            // to be raining meaningfully — mirrors data/generators/telemetry.py's
            // dust_index logic (drier + windier = dustier).
            float dustFactor = windIntensity * (1f - rainIntensity * 0.7f);
            SetEmissionRate(dustParticles, dustFactor * maxDustEmissionRate);

            RenderSettings.fog = true;
            float visibilityKm = Mathf.Max(0.05f, conditions.visibilityM / 1000f);
            RenderSettings.fogDensity = fogDensityAt1kmVisibility / visibilityKm;
        }

        private static void SetEmissionRate(ParticleSystem ps, float rate)
        {
            if (ps == null) return;
            var emission = ps.emission;
            emission.rateOverTime = rate;
            if (rate > 0f && !ps.isPlaying) ps.Play();
            else if (rate <= 0f && ps.isPlaying) ps.Stop();
        }
    }
}
