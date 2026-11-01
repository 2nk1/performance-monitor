import { describe, expect, it } from "vitest";
import { armSpanRatio } from "@/lib/growth/proportions";

describe("armSpanRatio", () => {
  it("divides arm span by height", () => {
    expect(armSpanRatio(180, 176)).toBeCloseTo(1.0227, 4);
  });

  it("returns null without arm span or with an invalid height", () => {
    expect(armSpanRatio(null, 176)).toBeNull();
    expect(armSpanRatio(180, 0)).toBeNull();
  });
});
