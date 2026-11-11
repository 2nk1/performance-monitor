import { describe, expect, it } from "vitest";
import { buildGrowthAnalysis } from "@/lib/growth/analysis";
import {
  SHERAR_LEFT_TO_GROW_CM,
  mirwaldMaturityOffset,
  predictMirwaldSherar,
  sherarLeftToGrow,
  sherarMaturityGroup,
} from "@/lib/growth/mirwald-sherar";
import type { GrowthMeasurement, GrowthProfile } from "@/lib/types";

describe("Mirwald maturity offset", () => {
  it("matches a hand-calculated value for a boy", () => {
    // Beinlänge 72, Sitzhöhe 78, Alter 12, 40 kg / 150 cm
    const expected =
      -9.236 +
      0.0002708 * (72 * 78) -
      0.001663 * (12 * 72) +
      0.007216 * (12 * 78) +
      0.02292 * ((40 / 150) * 100);

    expect(
      mirwaldMaturityOffset({
        sex: "male",
        age: 12,
        heightCm: 150,
        sittingHeightCm: 78,
        weightKg: 40,
      }),
    ).toBeCloseTo(expected, 10);
    expect(expected).toBeCloseTo(-1.786, 2);
  });

  it("matches a hand-calculated value for a girl", () => {
    const expected =
      -9.376 +
      0.0001882 * (72 * 78) +
      0.0022 * (11 * 72) +
      0.005841 * (11 * 78) -
      0.002658 * (11 * 40) +
      0.07693 * ((40 / 150) * 100);

    expect(
      mirwaldMaturityOffset({
        sex: "female",
        age: 11,
        heightCm: 150,
        sittingHeightCm: 78,
        weightKg: 40,
      }),
    ).toBeCloseTo(expected, 10);
  });
});

describe("Sherar left to grow", () => {
  it("has 41 rows per curve that fall monotonically to zero", () => {
    for (const sex of ["male", "female"] as const) {
      for (const group of ["early", "average", "late"] as const) {
        const rows = SHERAR_LEFT_TO_GROW_CM[sex][group];

        expect(rows).toHaveLength(41);
        expect(rows.at(-1)).toBe(0);
        rows.slice(1).forEach((value, i) => expect(value).toBeLessThanOrEqual(rows[i]));
      }
    }
  });

  it("orders the curves early > average > late before the spurt", () => {
    for (const sex of ["male", "female"] as const) {
      const { early, average, late } = SHERAR_LEFT_TO_GROW_CM[sex];

      for (let i = 0; i <= 20; i += 1) {
        expect(early[i]).toBeGreaterThan(average[i]);
        expect(average[i]).toBeGreaterThan(late[i]);
      }
    }
  });

  it("reproduces the worked example of the paper (149.4 cm + 30.06 cm = 179.46 cm)", () => {
    expect(sherarLeftToGrow("male", "average", -2)).toBeCloseTo(30.06, 6);
  });

  it("reads the table edges and interpolates between rows", () => {
    expect(sherarLeftToGrow("male", "average", -4)).toBeCloseTo(40.09, 6);
    expect(sherarLeftToGrow("female", "early", 4)).toBe(0);
    expect(sherarLeftToGrow("female", "average", 0)).toBeCloseTo(14.75, 6);
    expect(sherarLeftToGrow("male", "average", -1.9)).toBeCloseTo((30.06 + 29.03) / 2, 6);
  });

  it("returns null beyond 4 years from the spurt", () => {
    expect(sherarLeftToGrow("male", "average", -4.1)).toBeNull();
    expect(sherarLeftToGrow("male", "average", 4.1)).toBeNull();
  });

  it("groups by predicted age at PHV within one year of 14 (boys) and 12 (girls)", () => {
    expect(sherarMaturityGroup("male", 12.9)).toBe("early");
    expect(sherarMaturityGroup("male", 13)).toBe("average");
    expect(sherarMaturityGroup("male", 15)).toBe("average");
    expect(sherarMaturityGroup("male", 15.1)).toBe("late");
    expect(sherarMaturityGroup("female", 10.9)).toBe("early");
    expect(sherarMaturityGroup("female", 13.1)).toBe("late");
  });
});

describe("Mirwald/Sherar prediction", () => {
  const input = { sex: "male", age: 12, heightCm: 150, sittingHeightCm: 78, weightKg: 40 } as const;

  it("adds the remaining growth to the current height", () => {
    const result = predictMirwaldSherar(input);

    expect(result.ageAtPhv).toBeCloseTo(12 - result.offsetYears, 10);
    expect(result.group).toBe("average");
    expect(result.predictedHeightCm).toBeCloseTo(
      150 + (sherarLeftToGrow("male", "average", result.offsetYears) ?? 0),
      10,
    );
  });

  it("lets a manual maturity group pick the curve", () => {
    const late = predictMirwaldSherar({ ...input, groupOverride: "late" });

    expect(late.group).toBe("late");
    expect(late.predictedHeightCm).toBeLessThan(predictMirwaldSherar(input).predictedHeightCm ?? 0);
  });
});

describe("buildGrowthAnalysis with Mirwald/Sherar", () => {
  const profile: GrowthProfile = {
    participant_id: "p1",
    sex: "male",
    birth_date: "2014-01-01",
    mother_height_cm: null,
    father_height_cm: null,
    maturity_override: null,
    maturity_delay_years: null,
    created_at: "",
    updated_at: "",
  };
  const measurement = (overrides: Partial<GrowthMeasurement>): GrowthMeasurement => ({
    id: crypto.randomUUID(),
    participant_id: "p1",
    measured_at: "2026-01-01",
    height_cm: 150,
    weight_kg: 40,
    sitting_height_cm: 78,
    arm_span_cm: null,
    notes: null,
    created_at: "",
    ...overrides,
  });
  const find = (measurements: GrowthMeasurement[], p = profile) =>
    buildGrowthAnalysis(p, measurements).predictions.find((x) => x.id === "mirwald-sherar");

  it("predicts without parental heights from the newest measurement with sitting height and weight", () => {
    const prediction = find([
      measurement({}),
      measurement({ measured_at: "2026-06-01", height_cm: 153, sitting_height_cm: null }),
    ]);

    expect(prediction?.basisDate).toBe("2026-01-01");
    expect(prediction?.value).toBeGreaterThan(170);
    expect(prediction?.range).toBe(5.35);
    expect(prediction?.missing).toEqual([]);
  });

  it("reports missing inputs", () => {
    expect(find([measurement({ sitting_height_cm: null })])?.missing).toEqual([
      "Messung mit Sitzhöhe und Gewicht",
    ]);
    expect(find([])?.missing).toEqual(["Messung"]);
  });

  it("reports when the measurement is too far from the spurt", () => {
    const prediction = find([
      measurement({
        measured_at: "2020-01-01",
        height_cm: 116,
        weight_kg: 21,
        sitting_height_cm: 63,
      }),
    ]);

    expect(prediction?.value).toBeNull();
    expect(prediction?.missing).toEqual([
      "Messung höchstens 4 Jahre vor oder nach dem Wachstumsschub",
    ]);
  });
});

describe("Mirwald/Sherar uses what is known about the spurt", () => {
  const profile: GrowthProfile = {
    participant_id: "p1",
    sex: "male",
    birth_date: "2010-01-01",
    mother_height_cm: null,
    father_height_cm: null,
    maturity_override: null,
    maturity_delay_years: null,
    created_at: "",
    updated_at: "",
  };
  const m = (date: string, height: number, extra: Partial<GrowthMeasurement> = {}) =>
    ({
      id: crypto.randomUUID(),
      participant_id: "p1",
      measured_at: date,
      height_cm: height,
      weight_kg: 45,
      sitting_height_cm: 75,
      arm_span_cm: null,
      notes: null,
      created_at: "",
      ...extra,
    }) as GrowthMeasurement;
  const find = (p: GrowthProfile, ms: GrowthMeasurement[]) =>
    buildGrowthAnalysis(p, ms).predictions.find((x) => x.id === "mirwald-sherar");

  // Gleichmäßiges Ruhewachstum von 5 cm/Jahr, nie ein Schub
  const flat = Array.from({ length: 12 }, (_, i) =>
    m(`${2018 + Math.floor(i / 2)}-${i % 2 ? "09" : "03"}-01`, 120 + i * 2.5),
  );

  it("never claims a past spurt while the measurements show none", () => {
    const prediction = find(profile, flat);

    expect(prediction?.value).not.toBeNull();
    expect(prediction?.description).toContain("geschätzt");
    expect(prediction?.description).not.toMatch(/\+\d/);
  });

  it("uses the late curve with the spurt still ahead for a manually set late type", () => {
    const late = find({ ...profile, maturity_override: "late" }, flat);

    expect(late?.description).toContain("noch nicht beobachtet");
    expect(late?.description).toContain("Spätentwickler");
    // Schub liegt voraus: mindestens das Restwachstum am Schubgipfel (ca. 13 cm)
    expect((late?.value ?? 0) - (flat.at(-1)?.height_cm ?? 0)).toBeGreaterThanOrEqual(13);
  });
});
