import { resources } from "./resources";

function flatten(obj: object, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      Object.assign(acc, flatten(value, path));
    } else {
      acc[path] = String(value);
    }
    return acc;
  }, {});
}

describe("i18n resources", () => {
  const en = flatten(resources.en.translation);
  const enKeys = Object.keys(en).sort();

  it.each(["hi", "ta"] as const)("%s has exactly the same keys as en (no missing/extra translations)", (lang) => {
    const keys = Object.keys(flatten(resources[lang].translation)).sort();
    expect(keys).toEqual(enKeys);
  });

  it.each(["hi", "ta"] as const)("%s has no blank or untranslated (identical-to-English) values", (lang) => {
    const translated = flatten(resources[lang].translation);
    for (const key of enKeys) {
      expect(translated[key].trim().length).toBeGreaterThan(0);
      expect(translated[key]).not.toBe(en[key]);
    }
  });
});
