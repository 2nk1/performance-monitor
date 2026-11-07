import { describe, expect, it } from "vitest";
import { buildJumpSeries } from "@/lib/growth/jump";

describe("buildJumpSeries", () => {
  it("computes jump height per test, sorted by age, skipping incomplete tests", () => {
    const series = buildJumpSeries(
      [
        { test_date: "2025-01-01", reach_height_cm: 200, jump_reach_cm: 240 },
        { test_date: "2024-01-01", reach_height_cm: 195, jump_reach_cm: 230 },
        { test_date: "2024-07-01", reach_height_cm: 197, jump_reach_cm: null },
      ],
      "2012-01-01",
    );

    expect(series.map((point) => point.jumpHeight)).toEqual([35, 40]);
    expect(series[0].age).toBeCloseTo(12, 1);
    expect(series[1].age).toBeCloseTo(13, 1);
  });
});
