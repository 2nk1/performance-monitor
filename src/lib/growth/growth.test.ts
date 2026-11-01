import { describe, expect, it } from "vitest";
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
    expect(kr?.missing).toEqual(["Größe beider Eltern", "Gewicht der letzten Messung"]);
    expect(analysis.maturity?.stage).toBeNull();
    expect(analysis.growthVelocity).toBeNull();
  });
});
