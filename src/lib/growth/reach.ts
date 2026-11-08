import { ageInYears } from "@/lib/growth/age";
import type { PerformanceTest } from "@/lib/types";

/**
 * Reichhöhe im Stand ist bei Jugendlichen etwa das 1,33-Fache der Körpergröße.
 * Damit wird die Reichhöhe auf Größen-Zentimeter umgerechnet, falls keine
 * Größenmessung nah an einem Reichhöhen-Test liegt.
 */
export const DEFAULT_HEIGHT_PER_REACH = 0.75;

/** Größe und Reichhöhe müssen so nah beieinander gemessen sein, um das Verhältnis zu bilden. */
const MAX_PAIR_GAP_YEARS = 0.5;

export type ReachTest = Pick<PerformanceTest, "test_date" | "reach_height_cm">;

export type ReachSamples = {
  /** Reichhöhe umgerechnet auf Größen-Zentimeter, nach Alter sortiert. */
  samples: { age: number; height_cm: number; measured_at: string }[];
  /** Faktor Größe/Reichhöhe. */
  scale: number;
  /** measured: aus einer Größenmessung nahe an einem Test; default: Erfahrungswert. */
  scaleSource: "measured" | "default";
};

/**
 * Reichhöhen-Tests als Ersatz für Größenmessungen. Die Wachstumsrate der
 * Reichhöhe wird über das Verhältnis Größe/Reichhöhe auf Größen-cm/Jahr
 * umgerechnet, damit Schwellen und Referenzkurve gleich bleiben.
 */
export function buildReachSamples(
  tests: ReachTest[],
  birthDate: string,
  heights: { age: number; height_cm: number }[],
): ReachSamples {
  const reach = tests
    .flatMap((test) =>
      test.reach_height_cm === null
        ? []
        : [
            {
              age: ageInYears(birthDate, test.test_date),
              reach: Number(test.reach_height_cm),
              measured_at: test.test_date,
            },
          ],
    )
    .sort((a, b) => a.age - b.age);

  let best: { gap: number; scale: number } | null = null;
  for (const height of heights) {
    for (const test of reach) {
      const gap = Math.abs(test.age - height.age);
      if (gap <= MAX_PAIR_GAP_YEARS && (!best || gap < best.gap)) {
        best = { gap, scale: height.height_cm / test.reach };
      }
    }
  }

  const scale = best?.scale ?? DEFAULT_HEIGHT_PER_REACH;

  return {
    samples: reach.map((test) => ({
      age: test.age,
      height_cm: test.reach * scale,
      measured_at: test.measured_at,
    })),
    scale,
    scaleSource: best ? "measured" : "default",
  };
}
