import { describe, expect, it } from "vitest";
import { classifyPhvTiming } from "@/lib/growth/timing";
import { buildVelocitySeries } from "@/lib/growth/velocity";
import {
  ageInYears,
  buildGrowthAnalysis,
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
    arm_span_cm: null,
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
  maturity_delay_years: null,
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
    expect(analysis.percentOfTarget).not.toBeNull();
  });

  it("reports missing inputs instead of a value", () => {
    const analysis = buildGrowthAnalysis({ ...boyProfile, mother_height_cm: null }, [
      measurement({ measured_at: "2025-07-01", weight_kg: null }),
    ]);

    const kr = analysis.predictions.find((p) => p.id === "khamis-roche");
    expect(kr?.value).toBeNull();
    expect(kr?.missing).toEqual(["Größe beider Eltern", "Messung mit Gewicht"]);
    expect(analysis.percentOfTarget).toBeNull();
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
  it("builds annualised velocities and merges intervals under about 6 months", () => {
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
    expect(analysis.timing).toBeNull();
    expect(analysis.phvEstimate).not.toBeNull();
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

/** Gleichmäßiges Wachstum ohne Schub (`velocity` cm/Jahr), Messungen alle `step` Jahre. */
function flatMeasurements(velocity: number, fromAge: number, toAge: number, step: number) {
  const result: GrowthMeasurement[] = [];
  let height = 125;

  for (let age = fromAge; age <= toAge + 1e-9; age += step) {
    const date = new Date(Date.UTC(2010, 0, 1) + age * 365.25 * 86400000);
    result.push(measurement({ measured_at: date.toISOString().slice(0, 10), height_cm: height }));
    height += velocity * step;
  }

  return result;
}

describe("rate over at least 6 months and presumed late", () => {
  it("merges dense quarterly measurements into 6-month rates", () => {
    const analysis = buildGrowthAnalysis(spurtProfile(), flatMeasurements(5, 9, 11, 0.25));

    expect(analysis.velocity.length).toBeLessThanOrEqual(5);
    analysis.velocity.forEach((point) => {
      expect(point.intervalYears).toBeGreaterThanOrEqual(0.45);
      expect(point.velocity).toBeCloseTo(5, 1);
    });
  });

  it("classifies a girl past 12.9 without any visible spurt as late (presumed)", () => {
    const analysis = buildGrowthAnalysis(
      spurtProfile({ sex: "female" }),
      flatMeasurements(5, 8, 14, 0.25),
    );

    expect(analysis.peak.status).toBe("pending");
    expect(analysis.peak.reason).toBe("no-spurt");
    expect(analysis.timing).toMatchObject({ timing: "late", source: "presumed" });
  });

  it("does not presume late while the player is younger than the late threshold", () => {
    const analysis = buildGrowthAnalysis(
      spurtProfile({ sex: "female" }),
      flatMeasurements(5, 8, 12, 0.25),
    );

    expect(analysis.timing).toBeNull();
    expect(analysis.phvEstimate).not.toBeNull();
  });

  it("does not presume late for a boy of 14 (late threshold is 15.1)", () => {
    const analysis = buildGrowthAnalysis(spurtProfile(), flatMeasurements(5, 8, 14, 0.25));

    expect(analysis.timing).toBeNull();
  });

  it("presumes late when the highest rate is only just after the late threshold", () => {
    const analysis = buildGrowthAnalysis(
      spurtProfile({ sex: "female" }),
      spurtMeasurements(14.5, 8.5, 14.5),
    );

    expect(analysis.peak.reason).toBe("rising");
    expect(analysis.timing).toMatchObject({ timing: "late", source: "presumed" });
  });

  it("lets a manual override beat the presumption", () => {
    const analysis = buildGrowthAnalysis(
      spurtProfile({ sex: "female", maturity_override: "average" }),
      flatMeasurements(5, 8, 14, 0.25),
    );

    expect(analysis.timing).toMatchObject({ timing: "average", source: "manual" });
  });
});

describe("no classification from the Moore estimate alone", () => {
  it("returns no timing for a boy far before the spurt, but still the estimate as a number", () => {
    const analysis = buildGrowthAnalysis(spurtProfile(), flatMeasurements(5, 7, 11.5, 0.25));

    expect(analysis.timing).toBeNull();
    expect(analysis.phvEstimate?.age).toBeGreaterThan(11);
    expect(analysis.phvEstimate?.equation).toContain("Moore");
  });

  it("returns no estimate outside the age range where Moore is meaningful", () => {
    const analysis = buildGrowthAnalysis(spurtProfile(), flatMeasurements(5, 3, 7.5, 0.25));

    expect(analysis.phvEstimate).toBeNull();
  });
});

describe("childhood deceleration is not mistaken for a spurt", () => {
  /** Hohe Rate im Grundschulalter, die bis etwa 9,5 Jahre abklingt, danach flach. */
  function deceleratingMeasurements(fromAge: number, toAge: number, step: number) {
    const result: GrowthMeasurement[] = [];
    let height = 118;

    for (let age = fromAge; age <= toAge + 1e-9; age += step) {
      const date = new Date(Date.UTC(2010, 0, 1) + age * 365.25 * 86400000);
      result.push(measurement({ measured_at: date.toISOString().slice(0, 10), height_cm: height }));
      height += (5 + 6 * Math.exp(-(age + step / 2 - 7) / 1.2)) * step;
    }

    return result;
  }

  it("still presumes late for a girl whose highest rate is the end of childhood deceleration", () => {
    const analysis = buildGrowthAnalysis(
      spurtProfile({ sex: "female" }),
      deceleratingMeasurements(6.5, 14, 0.25),
    );

    expect(analysis.peak.status).toBe("pending");
    expect(analysis.peak.reason).toBe("no-spurt");
    expect(analysis.timing).toMatchObject({ timing: "late", source: "presumed" });
  });

  it("keeps 'no rise observed' when the data only starts late (spurt may be earlier)", () => {
    const analysis = buildGrowthAnalysis(spurtProfile(), spurtMeasurements(12.0, 12, 16));

    expect(analysis.peak.reason).not.toBe("no-spurt");
  });
});

describe("Khamis-Roche with developmental age", () => {
  const girl: GrowthProfile = {
    ...boyProfile,
    sex: "female",
    birth_date: "2012-01-01",
    mother_height_cm: 176,
    father_height_cm: 189,
  };
  const measurements = [measurement({ measured_at: "2026-01-10", height_cm: 163, weight_kg: 50 })];

  it("adds no extra prediction without a delay, or with a delay of zero", () => {
    expect(buildGrowthAnalysis(girl, measurements).predictions).toHaveLength(2);
    expect(
      buildGrowthAnalysis({ ...girl, maturity_delay_years: 0 }, measurements).predictions,
    ).toHaveLength(2);
  });

  it("computes the target at age minus delay and places it after Khamis-Roche", () => {
    const analysis = buildGrowthAnalysis({ ...girl, maturity_delay_years: 3 }, measurements);
    const age = analysis.points[0].age;
    const adjusted = analysis.predictions.find((p) => p.id === "khamis-roche-adjusted");

    expect(analysis.predictions.map((p) => p.id)).toEqual([
      "khamis-roche",
      "khamis-roche-adjusted",
      "mid-parent",
    ]);
    expect(adjusted?.value).toBeCloseTo(
      predictKhamisRoche({
        sex: "female",
        age: age - 3,
        heightCm: 163,
        weightKg: 50,
        motherHeightCm: 176,
        fatherHeightCm: 189,
      }) ?? 0,
      6,
    );
    expect(adjusted?.range).toBeNull();
  });

  it("gives a higher target for a late maturing girl and a lower one for an early maturing girl", () => {
    const base = buildGrowthAnalysis(girl, measurements).predictions[0].value ?? 0;
    const late = buildGrowthAnalysis({ ...girl, maturity_delay_years: 3 }, measurements)
      .predictions[1].value;
    const early = buildGrowthAnalysis({ ...girl, maturity_delay_years: -2 }, measurements)
      .predictions[1].value;

    expect(late).toBeGreaterThan(base + 5);
    expect(early).toBeLessThan(base);
  });

  it("reports why it cannot be computed", () => {
    // Alter 14 und vier Jahre früher dran ergibt Entwicklungsalter 18: außerhalb von 4 bis 17,5.
    const outOfRange = buildGrowthAnalysis({ ...girl, maturity_delay_years: -4 }, measurements);
    const noWeight = buildGrowthAnalysis({ ...girl, maturity_delay_years: 3 }, [
      measurement({ measured_at: "2026-01-10", height_cm: 163, weight_kg: null }),
    ]);

    expect(outOfRange.predictions[1].value).toBeNull();
    expect(outOfRange.predictions[1].missing).toEqual([
      "Entwicklungsalter zwischen 4 und 17,5 Jahren",
    ]);
    expect(noWeight.predictions[1].missing).toEqual(["Messung mit Gewicht"]);
  });

  it("uses the adjusted target for the percentage of the target reached", () => {
    const plain = buildGrowthAnalysis(girl, measurements);
    const adjusted = buildGrowthAnalysis({ ...girl, maturity_delay_years: 3 }, measurements);
    const target = adjusted.predictions.find((p) => p.id === "khamis-roche-adjusted")?.value ?? 1;

    expect(adjusted.percentOfTarget).toBeCloseTo((163 / target) * 100, 6);
    expect(adjusted.percentOfTarget).toBeLessThan(plain.percentOfTarget ?? 0);
  });
});

describe("a flat spurt that is already over", () => {
  /**
   * Mädchen nahe am KiGGS-Median: Der Schub ist flach (7,9 cm/Jahr roh, geglättet
   * kaum über dem Ruhewachstum), danach fällt die Rate bis fast auf null.
   */
  function flatSpurtMeasurements() {
    const ages = [5.7, 6.9, 7.6, 8.26, 9.64, 10.46, 11.34, 12.46, 13.34, 13.86, 15.5];
    const rates = [5.0, 5.7, 5.0, 7.0, 5.5, 6.6, 8.2, 3.8, 2.5, 0.3];
    let height = 110;

    return ages.map((age, index) => {
      if (index > 0) height += rates[index - 1] * (age - ages[index - 1]);
      const date = new Date(Date.UTC(2010, 0, 1) + age * 365.25 * 86400000);
      return measurement({
        measured_at: date.toISOString().slice(0, 10),
        height_cm: Math.round(height * 10) / 10,
        weight_kg: null,
      });
    });
  }

  it("confirms the peak instead of presuming a late spurt when growth is nearly finished", () => {
    const analysis = buildGrowthAnalysis(spurtProfile({ sex: "female" }), flatSpurtMeasurements());

    expect(analysis.peak.status).toBe("confirmed");
    expect(analysis.peak.age).toBeGreaterThan(10.9);
    expect(analysis.peak.age).toBeLessThan(12.5);
    expect(analysis.timing).toMatchObject({ timing: "average", source: "observed" });
  });
});

describe("peak from standing reach when heights are missing", () => {
  const profile = spurtProfile();
  /** Reichhöhen-Tests aus der synthetischen Kurve: Reichhöhe = Größe / 0,76 (gerundet auf cm). */
  const reachTests = (peakAge: number, fromAge: number, toAge: number) =>
    spurtMeasurements(peakAge, fromAge, toAge).map((m) => ({
      test_date: m.measured_at,
      reach_height_cm: Math.round(m.height_cm / 0.76),
    }));

  it("uses reach tests and the ratio from a single height measurement", () => {
    const tests = reachTests(13.8, 9, 17);
    const single = spurtMeasurements(13.8, 9, 17)[8];
    const analysis = buildGrowthAnalysis(profile, [single], tests);

    expect(analysis.velocitySource).toMatchObject({ kind: "reach", scaleSource: "measured" });
    if (analysis.velocitySource.kind === "reach") {
      expect(analysis.velocitySource.scale).toBeCloseTo(0.76, 2);
    }
    expect(analysis.peak.status).toBe("confirmed");
    expect(analysis.peak.age).toBeGreaterThan(13.3);
    expect(analysis.peak.age).toBeLessThan(14.3);
    expect(analysis.timing).toMatchObject({ timing: "average", source: "observed" });
  });

  it("falls back to the default ratio without any height", () => {
    const analysis = buildGrowthAnalysis(profile, [], reachTests(13.8, 9, 17));

    expect(analysis.velocitySource).toMatchObject({ kind: "reach", scaleSource: "default" });
    expect(analysis.peak.status).toBe("confirmed");
  });

  it("keeps heights when they are sufficient", () => {
    const analysis = buildGrowthAnalysis(
      profile,
      spurtMeasurements(13.8, 9, 17),
      reachTests(11, 9, 17),
    );

    expect(analysis.velocitySource).toEqual({ kind: "height" });
    expect(analysis.peak.age).toBeGreaterThan(13.3);
  });

  it("stays insufficient when the reach tests are too sparse as well", () => {
    const analysis = buildGrowthAnalysis(profile, [], reachTests(13.8, 12, 13));

    expect(analysis.velocitySource).toEqual({ kind: "height" });
    expect(analysis.peak.status).toBe("insufficient");
  });
});
