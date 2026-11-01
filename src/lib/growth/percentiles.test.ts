import { describe, expect, it } from "vitest";
import {
  formatPercentile,
  heightPercentile,
  heightZScore,
  referenceAt,
  referenceCurve,
} from "@/lib/growth/percentiles";
import { KIGGS_HEIGHT } from "@/lib/growth/reference/kiggs-height";

describe("KiGGS table", () => {
  it.each(["male", "female"] as const)("is sorted and plausible for %s", (sex) => {
    const rows = KIGGS_HEIGHT[sex];

    rows.forEach((row, i) => {
      const [age, p3, p50, p97] = row;
      expect(p3).toBeLessThan(p50);
      expect(p50).toBeLessThan(p97);
      if (i > 0) {
        expect(age).toBeGreaterThan(rows[i - 1][0]);
        expect(p50).toBeGreaterThanOrEqual(rows[i - 1][2]);
      }
    });
    expect(rows[0][0]).toBe(0);
    expect(rows.at(-1)?.[0]).toBe(18);
  });

  // Stichproben gegen das RKI-Dokument (Referenzperzentile, 2. Aufl. 2013).
  it("matches spot checks from the RKI document", () => {
    expect(referenceAt("male", 10)?.p50).toBeCloseTo(141.55, 0);
    expect(referenceAt("male", 18)?.p97).toBeCloseTo(191.14, 0);
    expect(referenceAt("female", 5)?.p3).toBeCloseTo(102.5, 0);
    expect(referenceAt("female", 1)?.p97).toBeCloseTo(79.95, 0);
  });
});

describe("referenceAt", () => {
  it("returns the table values at table ages", () => {
    expect(referenceAt("male", 12)).toEqual({ p3: 137.9, p50: 152.2, p97: 166.8 });
    expect(referenceAt("female", 0.5)).toEqual({ p3: 61.7, p50: 66.5, p97: 71.2 });
  });

  it("interpolates monotonically between table ages and stays within neighbours", () => {
    const at = referenceAt("male", 13.5);

    expect(at?.p50).toBeGreaterThan(159.1);
    expect(at?.p50).toBeLessThan(166.9);
  });

  it("never decreases along the median curve", () => {
    const curve = referenceCurve("female", 0, 18, 0.1);

    curve.slice(1).forEach((point, i) => {
      expect(point.p50).toBeGreaterThanOrEqual(curve[i].p50 - 1e-9);
    });
  });

  it("returns null outside 0 to 18 years", () => {
    expect(referenceAt("male", -0.1)).toBeNull();
    expect(referenceAt("male", 18.1)).toBeNull();
    expect(referenceAt("male", Number.NaN)).toBeNull();
  });
});

describe("percentiles", () => {
  it("gives z = 0 at the median and ±1.88 at P3 and P97", () => {
    expect(heightZScore("male", 12, 152.2)).toBeCloseTo(0, 6);
    expect(heightZScore("male", 12, 166.8)).toBeCloseTo(1.8808, 4);
    expect(heightZScore("male", 12, 137.9)).toBeCloseTo(-1.8808, 4);
  });

  it("gives the 50th, 97th and 3rd percentile at those values", () => {
    expect(heightPercentile("female", 10, 141.2)).toBeCloseTo(50, 3);
    expect(heightPercentile("female", 10, 153.4)).toBeCloseTo(97, 0);
    expect(heightPercentile("female", 10, 128.9)).toBeCloseTo(3, 0);
  });

  it("rises with height and is null outside the reference range", () => {
    expect(heightPercentile("male", 14, 175)).toBeGreaterThan(
      heightPercentile("male", 14, 165) ?? 0,
    );
    expect(heightPercentile("male", 19, 180)).toBeNull();
  });

  it("formats percentiles", () => {
    expect(formatPercentile(0.4)).toBe("<1");
    expect(formatPercentile(99.6)).toBe(">99");
    expect(formatPercentile(23.4)).toBe("23");
  });
});
