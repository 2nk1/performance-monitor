import { describe, expect, it } from "vitest";
import { GROWTH_END_AGE, projectGrowth, recentGrowthRate } from "@/lib/growth/projection";

/** Gleichmäßiges Wachstum: Messungen alle `step` Jahre mit `rate` cm/Jahr. */
function linear(rate: number, fromAge: number, toAge: number, step = 0.5, start = 140) {
  const samples: { age: number; height_cm: number }[] = [];
  for (let age = fromAge; age <= toAge + 1e-9; age += step) {
    samples.push({ age, height_cm: start + rate * (age - fromAge) });
  }
  return samples;
}

describe("recentGrowthRate", () => {
  it("fits the last 12 months only", () => {
    const old = linear(10, 8, 12, 0.5, 100);
    const recent = linear(4, 12.5, 14, 0.5, 140);

    expect(recentGrowthRate([...old, ...recent])).toBeCloseTo(4, 5);
  });

  it("falls back to the last two measurements when they are sparse", () => {
    expect(
      recentGrowthRate([
        { age: 10, height_cm: 135 },
        { age: 11.3, height_cm: 142.8 },
      ]),
    ).toBeCloseTo(6, 5);
  });

  it("returns null with a single measurement or a gap that is too large", () => {
    expect(recentGrowthRate([{ age: 10, height_cm: 135 }])).toBeNull();
    expect(
      recentGrowthRate([
        { age: 8, height_cm: 125 },
        { age: 11, height_cm: 142 },
      ]),
    ).toBeNull();
  });

  it("never returns a negative rate", () => {
    expect(
      recentGrowthRate([
        { age: 13, height_cm: 160.4 },
        { age: 13.5, height_cm: 160.0 },
        { age: 14, height_cm: 159.8 },
      ]),
    ).toBe(0);
  });
});

describe("projectGrowth", () => {
  const samples = linear(6, 12, 14);

  it("starts at the last measurement and ends at the end of growth", () => {
    const projection = projectGrowth(samples, "female");

    expect(projection?.[0]).toEqual({ age: 14, height: samples.at(-1)?.height_cm });
    expect(projection?.at(-1)?.age).toBe(GROWTH_END_AGE.female);
  });

  it("lets the rate run out linearly: total gain is half of rate times remaining years", () => {
    const projection = projectGrowth(samples, "male");
    const gain = (projection?.at(-1)?.height ?? 0) - (samples.at(-1)?.height_cm ?? 0);

    expect(gain).toBeCloseTo((6 * (GROWTH_END_AGE.male - 14)) / 2, 5);
  });

  it("never decreases and flattens towards the end", () => {
    const projection = projectGrowth(samples, "male") ?? [];
    const steps = projection.slice(1).map((point, i) => point.height - projection[i].height);

    steps.forEach((step) => expect(step).toBeGreaterThanOrEqual(0));
    expect(steps.at(-1) ?? 0).toBeLessThan(steps[0]);
  });

  it("is a flat line when the player has stopped growing", () => {
    const projection = projectGrowth(linear(0, 15, 16.5), "female");

    expect(new Set(projection?.map((point) => point.height)).size).toBe(1);
  });

  it("returns null when growth is over, or when the rate is unknown", () => {
    expect(projectGrowth(linear(1, 16.5, 17.5), "female")).toBeNull();
    expect(projectGrowth([{ age: 12, height_cm: 150 }], "male")).toBeNull();
    expect(projectGrowth([], "male")).toBeNull();
  });
});
