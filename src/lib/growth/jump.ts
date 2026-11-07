import { ageInYears } from "@/lib/growth/analysis";
import { computeJumpHeight } from "@/lib/metrics";
import type { PerformanceTest } from "@/lib/types";

export type JumpPoint = {
  age: number;
  test_date: string;
  /** Sprungreichhöhe minus Reichhöhe im Stand. */
  jumpHeight: number;
};

/** Sprunghöhen aus den Leistungstests, nach Alter sortiert; Tests ohne beide Werte fallen weg. */
export function buildJumpSeries(
  tests: Pick<PerformanceTest, "test_date" | "reach_height_cm" | "jump_reach_cm">[],
  birthDate: string,
): JumpPoint[] {
  return tests
    .flatMap((test) => {
      const jumpHeight = computeJumpHeight(test);

      return jumpHeight === null
        ? []
        : [{ age: ageInYears(birthDate, test.test_date), test_date: test.test_date, jumpHeight }];
    })
    .sort((a, b) => a.age - b.age);
}
