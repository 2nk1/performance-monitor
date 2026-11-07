import { describe, expect, it } from "vitest";
import {
  MAX_GROWTH_COMPARISON_SERIES,
  bandKey,
  buildGrowthComparisonData,
  parseSelectedIds,
  seriesKey,
} from "@/lib/growth/comparison";
import type { GrowthComparisonAthlete } from "@/lib/types";

function athlete(overrides: Partial<GrowthComparisonAthlete>): GrowthComparisonAthlete {
  return {
    id: "a1",
    name: "A",
    birth_year: 2014,
    participant_type: "athlete",
    sex: "male",
    birth_date: "2014-01-01",
    measurements: [
      { measured_at: "2024-01-01", height_cm: 140 },
      { measured_at: "2025-01-01", height_cm: 146 },
    ],
    ...overrides,
  };
}

describe("buildGrowthComparisonData", () => {
  it("legt pro Person eine Serie über dem Alter an", () => {
    const data = buildGrowthComparisonData([
      athlete({ id: "a1" }),
      athlete({
        id: "a2",
        birth_date: "2013-07-01",
        measurements: [{ measured_at: "2024-07-01", height_cm: 150 }],
      }),
    ]);

    expect(data?.series.map((s) => s.key)).toEqual([seriesKey(0), seriesKey(1)]);
    const p0 = data?.rows.filter((row) => row[seriesKey(0)] !== undefined);
    expect(p0?.map((row) => Math.round(row.age))).toEqual([10, 11]);
    const p1 = data?.rows.find((row) => row[seriesKey(1)] !== undefined);
    expect(p1?.[seriesKey(1)]).toBe(150);
    expect(Math.round((p1?.age ?? 0) * 10) / 10).toBe(11);
  });

  it("zeigt bei einem Geschlecht nur ein Referenzband", () => {
    const data = buildGrowthComparisonData([athlete({ id: "a1" }), athlete({ id: "a2" })]);

    expect(data?.sexes).toEqual(["male"]);
    expect(data?.rows.some((row) => row[bandKey("female")] !== undefined)).toBe(false);
  });

  it("zeigt bei gemischten Geschlechtern beide Referenzbänder", () => {
    const data = buildGrowthComparisonData([
      athlete({ id: "a1", sex: "female" }),
      athlete({ id: "a2", sex: "male" }),
    ]);

    expect(data?.sexes).toEqual(["male", "female"]);
    expect(data?.rows.some((row) => row[bandKey("male")] !== undefined)).toBe(true);
    expect(data?.rows.some((row) => row[bandKey("female")] !== undefined)).toBe(true);
  });

  it("liefert null ohne Messungen", () => {
    expect(buildGrowthComparisonData([athlete({ measurements: [] })])).toBeNull();
  });

  it("kappt auf die Maximalzahl an Personen", () => {
    const many = Array.from({ length: 12 }, (_, i) => athlete({ id: `a${i}` }));
    expect(buildGrowthComparisonData(many)?.series).toHaveLength(MAX_GROWTH_COMPARISON_SERIES);
  });
});

describe("parseSelectedIds", () => {
  it("filtert unbekannte und doppelte IDs", () => {
    expect(parseSelectedIds("a,x,a,b", new Set(["a", "b"]))).toEqual(["a", "b"]);
  });

  it("kappt auf das Maximum", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `a${i}`);
    expect(parseSelectedIds(ids.join(","), new Set(ids))).toHaveLength(
      MAX_GROWTH_COMPARISON_SERIES,
    );
  });

  it("liefert ohne Parameter eine leere Auswahl", () => {
    expect(parseSelectedIds(null, new Set(["a"]))).toEqual([]);
  });
});
