import { describe, expect, it } from "vitest";
import { classifyPhvTiming } from "@/lib/growth/timing";
import { buildVelocitySeries } from "@/lib/growth/velocity";
import {
  ageInYears,
  buildGrowthAnalysis,
  maturityStageFromPah,
  midParentTargetHeight,
  mooreMaturityOffset,
} from "@/lib/growth/analysis";
import {
  KHAMIS_ROCHE_COEFFICIENTS,
  khamisRocheCoefficientsAt,
  predictKhamisRoche,
} from "@/lib/growth/khamis-roche";
import type { GrowthMeasurement, GrowthProfile } from "@/lib/types";

function measurement(overrides: Partial<GrowthMeasurement>): GrowthMeasurement {
  return {
    id: crypto.randomUUID(),
    participant_id: "p1",
    measured_at: "2026-01-01",
    height_cm: 150,
    weight_kg: 40,
    sitting_height_cm: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const boyProfile: GrowthProfile = {
  participant_id: "p1",
  sex: "male",
  birth_date: "2014-01-01",
  mother_height_cm: 165,
  father_height_cm: 180,
  maturity_override: null,
  created_at: "",
  updated_at: "",
};

describe("Khamis-Roche coefficients", () => {
  it.each(["male", "female"] as const)("has 28 half-year rows from 4.0 to 17.5 for %s", (sex) => {
    const rows = KHAMIS_ROCHE_COEFFICIENTS[sex];
    expect(rows).toHaveLength(28);
    rows.forEach((row, index) => expect(row[0]).toBe(4 + index * 0.5));
  });

  // Die publizierten Koeffizienten sind geglättet. Ein Tippfehler in einer
  // Zeile würde als Ausreißer in der zweiten Differenz sichtbar.
  it.each(["male", "female"] as const)("is smooth (no transcription outliers) for %s", (sex) => {
    const rows = KHAMIS_ROCHE_COEFFICIENTS[sex];
    for (const column of [1, 2, 3, 4] as const) {
      const values = rows.map((row) => row[column]);
      const range = Math.max(...values) - Math.min(...values);
      for (let i = 1; i < values.length - 1; i++) {
        const secondDiff = Math.abs(values[i - 1] - 2 * values[i] + values[i + 1]);
        expect(secondDiff, `${sex} column ${column} row ${i}`).toBeLessThan(range * 0.25);
      }
    }
  });

  it("interpolates linearly between half-year rows", () => {
    const at = khamisRocheCoefficientsAt("female", 12.25);
    expect(at?.b0).toBeCloseTo((4.84365 + 4.27869) / 2, 6);
  });

  it("returns null outside 4.0–17.5 years", () => {
    expect(khamisRocheCoefficientsAt("male", 3.9)).toBeNull();
    expect(khamisRocheCoefficientsAt("male", 17.6)).toBeNull();
  });

  it("matches a hand-calculated prediction (boy, 10.0 y)", () => {
    const value = predictKhamisRoche({
      sex: "male",
      age: 10,
      heightCm: 140,
      weightKg: 32,
      motherHeightCm: 165,
      fatherHeightCm: 180,
    });
    expect(value).toBeCloseTo(180.02, 1);
  });

  it("matches a hand-calculated prediction (girl, 12.25 y, interpolated)", () => {
    const value = predictKhamisRoche({
      sex: "female",
      age: 12.25,
      heightCm: 150,
      weightKg: 40,
      motherHeightCm: 160,
      fatherHeightCm: 175,
    });
    expect(value).toBeCloseTo(163.3, 1);
  });
});

describe("other growth models", () => {
  it("computes mid-parent target height with ±13 cm sex adjustment", () => {
    expect(midParentTargetHeight("male", 165, 180)).toBe(179);
    expect(midParentTargetHeight("female", 165, 180)).toBe(166);
  });

  it("uses Moore-1 for boys with sitting height", () => {
    const result = mooreMaturityOffset({
      sex: "male",
      age: 12,
      heightCm: 150,
      sittingHeightCm: 75,
    });
    expect(result.equation).toBe("Moore-1 (Sitzhöhe)");
    expect(result.offsetYears).toBeCloseTo(-1.7976, 3);
    expect(result.ageAtPhv).toBeCloseTo(13.7976, 3);
  });

  it("falls back to Moore-2 for boys without sitting height", () => {
    const result = mooreMaturityOffset({
      sex: "male",
      age: 12,
      heightCm: 150,
      sittingHeightCm: null,
    });
    expect(result.equation).toBe("Moore-2 (Größe)");
    expect(result.offsetYears).toBeCloseTo(-7.999994 + 0.0036124 * 12 * 150, 5);
  });

  it("classifies %PAH into bio-banding stages", () => {
    expect(maturityStageFromPah(84.9)).toBe("pre-puberty");
    expect(maturityStageFromPah(87)).toBe("early-puberty");
    expect(maturityStageFromPah(92)).toBe("mid-puberty");
    expect(maturityStageFromPah(96)).toBe("late-puberty");
  });

  it("computes decimal age", () => {
    expect(ageInYears("2014-01-01", "2024-01-01")).toBeCloseTo(10, 2);
  });
});

describe("buildGrowthAnalysis", () => {
  it("sorts measurements, computes predictions and growth velocity", () => {
    const analysis = buildGrowthAnalysis(boyProfile, [
      measurement({ measured_at: "2025-07-01", height_cm: 152, weight_kg: 41 }),
      measurement({ measured_at: "2025-01-01", height_cm: 148, weight_kg: 39 }),
    ]);

    expect(analysis.points.map((point) => point.height_cm)).toEqual([148, 152]);
    expect(analysis.latest?.khamisRoche).not.toBeNull();
    expect(analysis.predictions.find((p) => p.id === "khamis-roche")?.value).toBe(
      analysis.latest?.khamisRoche,
    );
    expect(analysis.predictions.find((p) => p.id === "mid-parent")?.value).toBe(179);
    expect(analysis.growthVelocity).toBeCloseTo(4 / 0.4959, 1);
    expect(analysis.maturity?.stage).not.toBeNull();
  });

  it("reports missing inputs instead of a value", () => {
    const analysis = buildGrowthAnalysis({ ...boyProfile, mother_height_cm: null }, [
      measurement({ measured_at: "2025-07-01", weight_kg: null }),
    ]);

    const kr = analysis.predictions.find((p) => p.id === "khamis-roche");
    expect(kr?.value).toBeNull();
    expect(kr?.missing).toEqual(["Größe beider Eltern", "Messung mit Gewicht"]);
    expect(analysis.maturity?.stage).toBeNull();
    expect(analysis.growthVelocity).toBeNull();
  });
});

/**
 * Synthetische Wachstumskurve: Ruhewachstum 5 cm/Jahr plus ein glockenförmiger
 * Schub (Spitze +4 cm/Jahr) um `peakAge`. Messungen alle `step` Jahre.
 */
function spurtMeasurements(peakAge: number, fromAge: number, toAge: number, step = 0.5) {
  const velocityAt = (age: number) => 5 + 4 * Math.exp(-((age - peakAge) ** 2) / (2 * 1.1 ** 2));
  const result: GrowthMeasurement[] = [];
  let height = 130;

  for (let age = fromAge; age <= toAge + 1e-9; age += step) {
    const months = Math.round(age * 12);
    const date = new Date(Date.UTC(2010, 0, 1));
    date.setUTCMonth(date.getUTCMonth() + months);
    result.push(
      measurement({
        measured_at: date.toISOString().slice(0, 10),
        height_cm: Math.round(height * 10) / 10,
        weight_kg: null,
      }),
    );
    height += velocityAt(age + step / 2) * step;
  }

  return result;
}

const spurtProfile = (overrides: Partial<GrowthProfile> = {}): GrowthProfile => ({
  ...boyProfile,
  birth_date: "2010-01-01",
  ...overrides,
});

describe("velocity and peak detection", () => {
  it("builds annualised velocities and skips intervals under 3 months", () => {
    const series = buildVelocitySeries([
      { age: 10, height_cm: 140, measured_at: "a" },
      { age: 10.1, height_cm: 140.5, measured_at: "b" },
      { age: 10.5, height_cm: 142, measured_at: "c" },
    ]);

    expect(series).toHaveLength(1);
    expect(series[0].velocity).toBeCloseTo(4, 5);
    expect(series[0].age).toBeCloseTo(10.25, 5);
  });

  it("confirms the observed peak close to the true peak age", () => {
    const analysis = buildGrowthAnalysis(spurtProfile(), spurtMeasurements(13.8, 9, 17));

    expect(analysis.peak.status).toBe("confirmed");
    expect(analysis.peak.age).toBeGreaterThan(13.3);
    expect(analysis.peak.age).toBeLessThan(14.3);
    expect(analysis.timing).toMatchObject({ timing: "average", source: "observed" });
  });

  it("classifies an early peak (11.9) as early and a late peak (15.8) as late for boys", () => {
    const early = buildGrowthAnalysis(spurtProfile(), spurtMeasurements(11.9, 8.5, 16));
    const late = buildGrowthAnalysis(spurtProfile(), spurtMeasurements(15.8, 11, 18));

    expect(early.timing).toMatchObject({ timing: "early", source: "observed" });
    expect(late.timing).toMatchObject({ timing: "late", source: "observed" });
  });

  it("uses the girls' thresholds for girls", () => {
    const analysis = buildGrowthAnalysis(
      spurtProfile({ sex: "female" }),
      spurtMeasurements(11.9, 8.5, 16),
    );

    expect(analysis.timing).toMatchObject({ timing: "average", source: "observed" });
  });

  it("stays pending while the velocity is still rising", () => {
    const analysis = buildGrowthAnalysis(spurtProfile(), spurtMeasurements(14, 9, 13));

    expect(analysis.peak.status).toBe("pending");
    expect(analysis.peak.age).toBeNull();
    expect(analysis.timing?.source).toBe("estimated");
  });

  it("reports insufficient data for few measurements", () => {
    const analysis = buildGrowthAnalysis(spurtProfile(), spurtMeasurements(14, 10, 11.5));

    expect(analysis.peak.status).toBe("insufficient");
  });

  it("ignores the steep infant velocities when looking for the peak", () => {
    const infancyHeights: [number, number][] = [
      [0.1, 50],
      [0.5, 62],
      [1, 75],
      [1.5, 81],
      [2, 86],
      [3, 95],
      [4, 102],
      [5, 109],
      [6, 115],
      [7, 121],
      [8, 127],
    ];
    const infancy = infancyHeights.map(([age, height]) =>
      measurement({
        measured_at: new Date(Date.UTC(2010, 0, 1) + age * 365.25 * 86400000)
          .toISOString()
          .slice(0, 10),
        height_cm: height,
      }),
    );
    const analysis = buildGrowthAnalysis(spurtProfile(), [
      ...infancy,
      ...spurtMeasurements(13.8, 9, 17),
    ]);

    expect(analysis.peak.status).toBe("confirmed");
    expect(analysis.peak.age).toBeGreaterThan(13);
  });

  it("lets a manual override win over the automatic classification", () => {
    const analysis = buildGrowthAnalysis(
      spurtProfile({ maturity_override: "late" }),
      spurtMeasurements(13.8, 9, 17),
    );

    expect(analysis.timing).toMatchObject({ timing: "late", source: "manual" });
  });

  it("classifies boundaries correctly", () => {
    expect(classifyPhvTiming("male", 13.0)).toBe("early");
    expect(classifyPhvTiming("male", 13.1)).toBe("average");
    expect(classifyPhvTiming("male", 15.1)).toBe("average");
    expect(classifyPhvTiming("male", 15.2)).toBe("late");
    expect(classifyPhvTiming("female", 10.8)).toBe("early");
    expect(classifyPhvTiming("female", 13.0)).toBe("late");
  });
});

describe("Khamis-Roche fallback to latest measurement with weight", () => {
  it("uses the newest weighted measurement and keeps the current height for %", () => {
    const analysis = buildGrowthAnalysis(boyProfile, [
      measurement({ measured_at: "2025-01-01", height_cm: 148, weight_kg: 39 }),
      measurement({ measured_at: "2025-07-01", height_cm: 152, weight_kg: null }),
    ]);

    const kr = analysis.predictions.find((p) => p.id === "khamis-roche");
    expect(kr?.basisDate).toBe("2025-01-01");
    expect(kr?.value).toBe(analysis.points[0].khamisRoche);
    expect(analysis.percentOfTarget).toBeCloseTo((152 / (kr?.value ?? 1)) * 100, 6);
  });
});
