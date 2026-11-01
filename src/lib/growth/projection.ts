import type { GrowthSex } from "@/lib/types";

/**
 * Alter, mit dem das Längenwachstum im Mittel abgeschlossen ist: Mädchen
 * 16–18, Jungen 18–20 Jahre (Malina et al. 2019), hier die Mitte der Spannen.
 */
export const GROWTH_END_AGE: Record<GrowthSex, number> = { female: 17, male: 19 };

/** Die Rate stammt aus den Messungen der letzten 12 Monate. */
const RATE_WINDOW_YEARS = 1;
const MIN_RATE_SPAN_YEARS = 0.4;
const MAX_FALLBACK_GAP_YEARS = 1.5;
const STEP_YEARS = 0.5;

type Sample = { age: number; height_cm: number };
export type ProjectionPoint = { age: number; height: number };

/** Steigung der Ausgleichsgeraden in cm/Jahr. */
function slope(samples: Sample[]): number {
  const n = samples.length;
  const meanAge = samples.reduce((sum, sample) => sum + sample.age, 0) / n;
  const meanHeight = samples.reduce((sum, sample) => sum + sample.height_cm, 0) / n;
  const numerator = samples.reduce(
    (sum, sample) => sum + (sample.age - meanAge) * (sample.height_cm - meanHeight),
    0,
  );
  const denominator = samples.reduce((sum, sample) => sum + (sample.age - meanAge) ** 2, 0);

  return denominator === 0 ? 0 : numerator / denominator;
}

/** Wachstumsrate der letzten 12 Monate in cm/Jahr, falls genug Messungen vorliegen. */
export function recentGrowthRate(samples: Sample[]): number | null {
  const latest = samples.at(-1);

  if (!latest) {
    return null;
  }

  const recent = samples.filter((sample) => sample.age >= latest.age - RATE_WINDOW_YEARS);

  if (recent.length >= 2 && latest.age - recent[0].age >= MIN_RATE_SPAN_YEARS) {
    return Math.max(0, slope(recent));
  }

  // Seltene Messungen: Rate aus den letzten beiden, wenn sie nicht zu weit auseinander liegen.
  const previous = samples.at(-2);

  if (
    previous &&
    latest.age - previous.age >= MIN_RATE_SPAN_YEARS &&
    latest.age - previous.age <= MAX_FALLBACK_GAP_YEARS
  ) {
    return Math.max(0, slope([previous, latest]));
  }

  return null;
}

/**
 * Fortschreibung der Größenkurve: Die aktuelle Wachstumsrate läuft linear bis
 * zum Ende des Längenwachstums aus. Das ist eine Trendlinie, kein Prognosemodell:
 * Sie kennt weder den noch bevorstehenden Wachstumsschub noch die Zielgröße.
 * Der erste Punkt ist die letzte Messung, damit die Linie anschließt.
 */
export function projectGrowth(samples: Sample[], sex: GrowthSex): ProjectionPoint[] | null {
  const latest = samples.at(-1);
  const endAge = GROWTH_END_AGE[sex];

  if (!latest || latest.age >= endAge) {
    return null;
  }

  const rate = recentGrowthRate(samples);

  if (rate === null) {
    return null;
  }

  const span = endAge - latest.age;
  const heightAt = (elapsed: number) =>
    latest.height_cm + rate * (elapsed - elapsed ** 2 / (2 * span));

  const points: ProjectionPoint[] = [{ age: latest.age, height: latest.height_cm }];

  for (let elapsed = STEP_YEARS; elapsed < span; elapsed += STEP_YEARS) {
    points.push({ age: latest.age + elapsed, height: heightAt(elapsed) });
  }

  points.push({ age: endAge, height: heightAt(span) });

  return points;
}
