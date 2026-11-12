import { describe, expect, it } from "vitest";
import { buildGrowthAnalysis, selectPrimaryPrediction } from "@/lib/growth/analysis";
import { sherarLeftToGrow } from "@/lib/growth/mirwald-sherar";
import { buildTypeTrajectories, sherarOffsetForLeftToGrow } from "@/lib/growth/trajectory";
import type { GrowthMeasurement, GrowthProfile } from "@/lib/types";

describe("sherarOffsetForLeftToGrow", () => {
  it.each(["male", "female"] as const)("inverts sherarLeftToGrow for %s", (sex) => {
    for (const group of ["early", "average", "late"] as const) {
      for (const offset of [-3.7, -2, -0.5, 0.3, 1.1]) {
        const remaining = sherarLeftToGrow(sex, group, offset);
        expect(remaining).not.toBeNull();
        expect(sherarOffsetForLeftToGrow(sex, group, remaining ?? 0)).toBeCloseTo(offset, 5);
      }
    }
  });

  it("returns null for more growth than the table covers or a negative remainder", () => {
    expect(sherarOffsetForLeftToGrow("male", "average", 60)).toBeNull();
    expect(sherarOffsetForLeftToGrow("male", "average", -1)).toBeNull();
  });

  it("uses the earliest offset on the zero plateau", () => {
    // Späte Jungen haben ab +0,2 Jahren (Index 35) kein Restwachstum mehr.
    const offset = sherarOffsetForLeftToGrow("male", "late", 0);
    expect(offset).toBeCloseTo(-4 + 0.2 * 35, 5);
  });
});

describe("buildTypeTrajectories", () => {
  const base = { sex: "male", age: 13.5, heightCm: 160, targetCm: 183, knownGroup: null } as const;

  it("starts at the last measurement and ends at the target for every curve", () => {
    const result = buildTypeTrajectories({ ...base, maxOffsetYears: null });

    expect(result).not.toBeNull();
    expect(result?.ages[0]).toBe(13.5);
    expect(result?.curves.length).toBeGreaterThan(0);
    for (const curve of result?.curves ?? []) {
      expect(curve.heights).toHaveLength(result?.ages.length ?? -1);
      expect(curve.heights[0]).toBe(160);
      expect(curve.heights.at(-1)).toBeCloseTo(183, 5);
      curve.heights.slice(1).forEach((height, index) => {
        expect(height).toBeGreaterThanOrEqual(curve.heights[index] - 1e-9);
      });
    }
  });

  it("lets the types differ in tempo: the late type is steeper after the spurt starts", () => {
    const result = buildTypeTrajectories({ ...base, maxOffsetYears: null });
    const early = result?.curves.find((curve) => curve.group === "early");
    const late = result?.curves.find((curve) => curve.group === "late");

    // Nur Typen mit passendem Schubalter bleiben; passen beide, wächst der frühe zuerst.
    if (early && late) {
      expect(early.impliedPhvAge).toBeLessThan(late.impliedPhvAge);
      expect(early.heights[2]).toBeGreaterThan(late.heights[2]);
    }
  });

  it("drops types whose implied spurt age contradicts the type", () => {
    const result = buildTypeTrajectories({ ...base, maxOffsetYears: null });

    for (const curve of result?.curves ?? []) {
      const phv = curve.impliedPhvAge;
      if (curve.group === "early") expect(phv).toBeLessThan(13);
      if (curve.group === "average") expect(phv).toBeGreaterThanOrEqual(13);
      if (curve.group === "average") expect(phv).toBeLessThanOrEqual(15);
      if (curve.group === "late") expect(phv).toBeGreaterThan(15);
    }
  });

  it("does not assume a finished spurt when maxOffsetYears is 0", () => {
    // 175 von 183 cm mit 13,5 Jahren: nur ein Schub, der längst vorbei ist, erklärt das.
    const finished = buildTypeTrajectories({ ...base, heightCm: 178, maxOffsetYears: null });
    const capped = buildTypeTrajectories({ ...base, heightCm: 178, maxOffsetYears: 0 });

    expect(finished).not.toBeNull();
    for (const curve of capped?.curves ?? []) {
      expect(base.age - curve.impliedPhvAge).toBeLessThanOrEqual(1e-9);
    }
  });

  it("returns null when the target is below the current height", () => {
    expect(buildTypeTrajectories({ ...base, targetCm: 150, maxOffsetYears: null })).toBeNull();
  });

  it("marks the known type as active only if its curve exists", () => {
    const all = buildTypeTrajectories({ ...base, maxOffsetYears: null });
    const group = all?.curves[0]?.group ?? null;

    expect(
      buildTypeTrajectories({ ...base, knownGroup: group, maxOffsetYears: null }),
    ).toMatchObject({ activeGroup: group });
    const missing = (["early", "average", "late"] as const).find(
      (candidate) => !all?.curves.some((curve) => curve.group === candidate),
    );
    if (missing) {
      expect(
        buildTypeTrajectories({ ...base, knownGroup: missing, maxOffsetYears: null })?.activeGroup,
      ).toBeNull();
    }
  });
});

describe("selectPrimaryPrediction", () => {
  const prediction = (id: string, value: number | null) =>
    ({ id, value }) as Parameters<typeof selectPrimaryPrediction>[0][number];

  it("prefers Khamis-Roche, then Tanner, then Mirwald/Sherar", () => {
    expect(
      selectPrimaryPrediction([
        prediction("mirwald-sherar", 180),
        prediction("mid-parent", 179),
        prediction("khamis-roche", 181),
      ]),
    ).toBe("khamis-roche");
    expect(
      selectPrimaryPrediction([
        prediction("khamis-roche", null),
        prediction("mid-parent", 179),
        prediction("mirwald-sherar", 180),
      ]),
    ).toBe("mid-parent");
    expect(
      selectPrimaryPrediction([
        prediction("khamis-roche", null),
        prediction("mid-parent", null),
        prediction("mirwald-sherar", 180),
      ]),
    ).toBe("mirwald-sherar");
    expect(selectPrimaryPrediction([prediction("khamis-roche", null)])).toBeNull();
  });
});

function measurement(overrides: Partial<GrowthMeasurement>): GrowthMeasurement {
  return {
    id: crypto.randomUUID(),
    participant_id: "p1",
    measured_at: "2026-01-01",
    height_cm: 150,
    weight_kg: 40,
    sitting_height_cm: null,
    arm_span_cm: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const boy: GrowthProfile = {
  participant_id: "p1",
  sex: "male",
  birth_date: "2012-01-01",
  mother_height_cm: 165,
  father_height_cm: 180,
  maturity_override: null,
  maturity_delay_years: null,
  created_at: "",
  updated_at: "",
};

describe("primary prediction and trajectories in the analysis", () => {
  it("picks Khamis-Roche with weight and Tanner without", () => {
    const withWeight = buildGrowthAnalysis(boy, [
      measurement({ measured_at: "2026-01-01", height_cm: 160, weight_kg: 47 }),
    ]);
    const withoutWeight = buildGrowthAnalysis(boy, [
      measurement({ measured_at: "2026-01-01", height_cm: 160, weight_kg: null }),
    ]);

    expect(withWeight.primaryPredictionId).toBe("khamis-roche");
    expect(withoutWeight.primaryPredictionId).toBe("mid-parent");
  });

  it("picks Mirwald/Sherar without parent heights", () => {
    const analysis = buildGrowthAnalysis(
      { ...boy, mother_height_cm: null, father_height_cm: null },
      [
        measurement({
          measured_at: "2026-01-01",
          height_cm: 160,
          weight_kg: 47,
          sitting_height_cm: 82,
        }),
      ],
    );

    expect(analysis.primaryPredictionId).toBe("mirwald-sherar");
  });

  it("shows no Sherar band while the spurt is only presumed or estimated", () => {
    const analysis = buildGrowthAnalysis(
      { ...boy, mother_height_cm: null, father_height_cm: null },
      [
        measurement({
          measured_at: "2026-01-01",
          height_cm: 160,
          weight_kg: 47,
          sitting_height_cm: 82,
        }),
      ],
    );

    expect(analysis.predictions.find((p) => p.id === "mirwald-sherar")?.range).toBeNull();
  });

  it("builds no type trajectories before the pubertal window without an observed peak", () => {
    const analysis = buildGrowthAnalysis(boy, [
      measurement({ measured_at: "2024-01-01", height_cm: 140, weight_kg: 32 }),
      measurement({ measured_at: "2024-09-01", height_cm: 144, weight_kg: 35 }),
    ]);

    expect(analysis.latest?.age).toBeLessThan(13);
    expect(analysis.trajectories).toBeNull();
  });

  it("builds trajectories through the last point to the primary target in the window", () => {
    const analysis = buildGrowthAnalysis(boy, [
      measurement({ measured_at: "2025-01-01", height_cm: 152, weight_kg: 40 }),
      measurement({ measured_at: "2025-07-01", height_cm: 156, weight_kg: 43 }),
      measurement({ measured_at: "2026-02-01", height_cm: 162, weight_kg: 48 }),
    ]);
    const target = analysis.predictions.find((p) => p.id === analysis.primaryPredictionId)?.value;

    expect(analysis.latest?.age).toBeGreaterThanOrEqual(13);
    expect(analysis.trajectories).not.toBeNull();
    expect(analysis.trajectories?.target).toBe(target);
    for (const curve of analysis.trajectories?.curves ?? []) {
      expect(curve.heights[0]).toBe(162);
      expect(curve.heights.at(-1)).toBeCloseTo(target ?? 0, 5);
    }
  });
});
