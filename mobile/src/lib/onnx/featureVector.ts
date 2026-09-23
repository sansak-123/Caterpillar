/**
 * Mirrors ml/task_time/features.py's `encode_categoricals` + `FEATURE_COLUMNS` ordering
 * exactly (CLAUDE.md section 5.2: "mirrored at inference time in ml/task_time and
 * reused by ml/") so the vector fed to the on-device ONNX model matches what it was
 * trained on. The bundle's own feature_schema.json is the source of truth for column
 * order and categorical→integer mappings — nothing here is hardcoded against a
 * specific schema version.
 */

export type FeatureSchema = {
  features: string[];
  categorical_encodings: Record<string, string[]>;
  boolean_columns: string[];
};

export type TaskFeatureContext = Record<string, string | number | boolean | undefined>;

/**
 * Neutral stand-ins for feature values the mobile app has no local source for (the
 * server's morning-sync scoring uses a much richer per-task snapshot — soil survey,
 * shift roster, site congestion, etc. — that isn't replicated on-device). Documented
 * assumption, mirrored in data/calibration.md: unknown categoricals fall back to -1
 * (the same "unmapped category" convention `encode_categoricals` uses for a category
 * it's never seen), unknown booleans default to the safer/optimistic reading, and
 * unknown numerics default to a fleet-typical midpoint rather than 0 where 0 would be
 * misleadingly extreme (e.g. visibility_m, humidity_pct). Every prediction built from
 * these must be labeled "approximate (offline)" per CLAUDE.md §3.1 — never presented
 * as equivalent to the server's fully-informed estimate.
 */
const NUMERIC_FALLBACKS: Record<string, number> = {
  machine_age_yrs: 4,
  hours_since_last_service: 100,
  precip_mm: 0,
  wind_kmh: 10,
  visibility_m: 800,
  temp_c: 28,
  humidity_pct: 60,
  dig_depth_m: 2,
  haul_distance_m: 50,
  planned_volume_m3: 20,
  truck_wait_min: 5,
  number_of_trucks: 2,
  task_sequence_number_in_shift: 1,
  number_of_nearby_workers: 1,
  site_congestion_index_at_start: 0.3,
  operator_fatigue_score_at_start: 0.3,
  previous_task_overrun_ratio: 1.0,
  operator_idle_ratio_7d: 0.3,
  measured_skill_score: 0.6,
};

const BOOLEAN_FALLBACKS: Record<string, 0 | 1> = {
  is_holiday: 0,
  ppe_compliance_flag: 1,
  pre_start_checklist_completed: 0,
};

export type FeatureVectorResult = {
  vector: Float32Array;
  /** Feature names that had no local value and used a documented fallback instead. */
  approximatedFields: string[];
};

export function buildFeatureVector(schema: FeatureSchema, context: TaskFeatureContext): FeatureVectorResult {
  const approximatedFields: string[] = [];

  const values = schema.features.map((name) => {
    const categories = schema.categorical_encodings[name];
    if (categories) {
      const raw = context[name];
      if (typeof raw === "string") {
        const idx = categories.indexOf(raw);
        if (idx === -1) approximatedFields.push(name);
        return idx; // -1 for an unrecognized category, same as training-time encoding
      }
      approximatedFields.push(name);
      return -1;
    }

    if (schema.boolean_columns.includes(name)) {
      const raw = context[name];
      if (typeof raw === "boolean") return raw ? 1 : 0;
      if (typeof raw === "number") return raw ? 1 : 0;
      approximatedFields.push(name);
      return BOOLEAN_FALLBACKS[name] ?? 0;
    }

    const raw = context[name];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    approximatedFields.push(name);
    return NUMERIC_FALLBACKS[name] ?? 0;
  });

  return { vector: Float32Array.from(values), approximatedFields };
}
