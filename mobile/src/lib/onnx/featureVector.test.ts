import { buildFeatureVector, type FeatureSchema } from "./featureVector";

const SCHEMA: FeatureSchema = {
  features: ["task_type", "weather", "is_holiday", "wind_kmh", "temp_c"],
  categorical_encodings: {
    task_type: ["Demolition", "Earth Excavation", "Grading"],
    weather: ["Cloudy", "Rainy", "Sunny", "Windy"],
  },
  boolean_columns: ["is_holiday"],
};

describe("buildFeatureVector", () => {
  it("encodes a known category to its schema index, in feature-column order", () => {
    const { vector } = buildFeatureVector(SCHEMA, {
      task_type: "Grading",
      weather: "Sunny",
      is_holiday: false,
      wind_kmh: 15,
      temp_c: 31,
    });
    expect(Array.from(vector)).toEqual([2, 2, 0, 15, 31]);
  });

  it("encodes an unrecognized category as -1, same as the training-time convention", () => {
    const { vector, approximatedFields } = buildFeatureVector(SCHEMA, {
      task_type: "Some New Task Type",
      weather: "Sunny",
      is_holiday: false,
      wind_kmh: 15,
      temp_c: 31,
    });
    expect(vector[0]).toBe(-1);
    expect(approximatedFields).toContain("task_type");
  });

  it("encodes booleans as 0/1", () => {
    const { vector } = buildFeatureVector(SCHEMA, {
      task_type: "Grading",
      weather: "Sunny",
      is_holiday: true,
      wind_kmh: 15,
      temp_c: 31,
    });
    expect(vector[2]).toBe(1);
  });

  it("falls back to a documented default and flags the field when a value is missing", () => {
    const { vector, approximatedFields } = buildFeatureVector(SCHEMA, {
      task_type: "Grading",
      weather: "Sunny",
      is_holiday: false,
      temp_c: 31,
      // wind_kmh omitted
    });
    expect(vector[3]).toBe(10); // documented NUMERIC_FALLBACKS.wind_kmh
    expect(approximatedFields).toEqual(["wind_kmh"]);
  });

  it("prefers a real provided value over the fallback", () => {
    const { vector, approximatedFields } = buildFeatureVector(SCHEMA, {
      task_type: "Grading",
      weather: "Sunny",
      is_holiday: false,
      wind_kmh: 42,
      temp_c: 31,
    });
    expect(vector[3]).toBe(42);
    expect(approximatedFields).toEqual([]);
  });
});
