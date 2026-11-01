/**
 * Die Rate wird über mindestens etwa 6 Monate gerechnet (5,5 Monate, damit
 * halbjährliche Messungen zählen). Kürzere Abstände machen aus kleinen
 * Messfehlern große Schwankungen in der Jahresrate.
 */
export const MIN_INTERVAL_YEARS = 0.45;

/** Intervalle über 1,5 Jahre sind für die Gipfelerkennung zu grob. */
const MAX_PEAK_INTERVAL_YEARS = 1.5;

/**
 * Nur Intervalle in diesem Altersbereich zählen als Kandidaten für den
 * Wachstumsschub: In der frühen Kindheit ist die Geschwindigkeit hoch und
 * fällt nur ab, das wäre sonst fälschlich der "Gipfel".
 */
const PEAK_MIN_AGE = 8;
const PEAK_MAX_AGE = 18;

/** Darunter ist der Anstieg keine pubertäre Wachstumsspitze (Ruhewachstum ca. 5–6 cm/Jahr). */
const MIN_PEAK_VELOCITY = 6.5;

/** Ab dem zweiten Intervall nach dem Gipfel muss die Geschwindigkeit im Mittel unter diesen Anteil fallen (breite Gipfel sinken langsam). */
const DROP_FACTOR = 0.9;

const MIN_CANDIDATE_INTERVALS = 4;

type Sample = { age: number; height_cm: number; measured_at: string };

export type VelocityPoint = {
  /** Alter in der Mitte des Intervalls. */
  age: number;
  /** cm pro Jahr, aufs Jahr hochgerechnet. */
  velocity: number;
  /** Gewichteter gleitender Mittelwert über drei Intervalle (dämpft Messfehler). */
  smoothed: number;
  intervalYears: number;
  from: string;
  to: string;
};

/** Wachstumsgeschwindigkeit zwischen aufeinanderfolgenden Messungen (chronologisch sortiert). */
export function buildVelocitySeries(samples: Sample[]): VelocityPoint[] {
  if (samples.length < 2) {
    return [];
  }

  const raw: Omit<VelocityPoint, "smoothed">[] = [];
  let anchor = samples[0];

  for (const sample of samples.slice(1)) {
    const years = sample.age - anchor.age;

    if (years < MIN_INTERVAL_YEARS) {
      continue;
    }

    raw.push({
      age: (anchor.age + sample.age) / 2,
      velocity: (sample.height_cm - anchor.height_cm) / years,
      intervalYears: years,
      from: anchor.measured_at,
      to: sample.measured_at,
    });
    anchor = sample;
  }

  // Nur direkt benachbarte, nicht zu lange Intervalle fließen in die Glättung ein.
  const neighbourVelocity = (neighbour: (typeof raw)[number] | undefined, fallback: number) =>
    neighbour && neighbour.intervalYears <= MAX_PEAK_INTERVAL_YEARS ? neighbour.velocity : fallback;

  return raw.map((point, index) => {
    const previous = neighbourVelocity(raw[index - 1], point.velocity);
    const next = neighbourVelocity(raw[index + 1], point.velocity);
    const smoothed =
      raw[index - 1] && raw[index + 1]
        ? 0.25 * previous + 0.5 * point.velocity + 0.25 * next
        : point.velocity;

    return { ...point, smoothed };
  });
}

export type PeakResult = {
  /**
   * confirmed: Gipfel beobachtet (Anstieg und deutlicher Abfall gesehen).
   * pending: Messungen vorhanden, aber Gipfel noch nicht bestätigt.
   * insufficient: zu wenige Messungen für eine Aussage.
   */
  status: "confirmed" | "pending" | "insufficient";
  /**
   * Warum der Gipfel nicht bestätigt ist:
   * no-spurt: Geschwindigkeit blieb durchweg unter der Schwelle, es ist noch kein Schub zu sehen.
   * rising: der höchste Wert liegt bei den letzten Messungen.
   * no-rise / no-drop: Anstieg bzw. Abfall wurden nicht beobachtet.
   */
  reason: "confirmed" | "insufficient" | "no-spurt" | "rising" | "no-rise" | "no-drop";
  /** Alter beim höchsten beobachteten Wert (Intervallmitte), auch wenn er noch nicht bestätigt ist. */
  highestAge: number | null;
  /** Alter beim Gipfel (Intervallmitte), nur bei `confirmed`. */
  age: number | null;
  /** Geglättete Spitzengeschwindigkeit in cm/Jahr, nur bei `confirmed`. */
  velocity: number | null;
  note: string;
};

/** Erkennt den beobachteten Gipfel der Wachstumsgeschwindigkeit (Peak Height Velocity). */
export function detectPeak(series: VelocityPoint[]): PeakResult {
  const candidates = series.filter(
    (point) =>
      point.age >= PEAK_MIN_AGE &&
      point.age <= PEAK_MAX_AGE &&
      point.intervalYears <= MAX_PEAK_INTERVAL_YEARS,
  );

  if (candidates.length < MIN_CANDIDATE_INTERVALS) {
    return {
      status: "insufficient",
      reason: "insufficient",
      highestAge: null,
      age: null,
      velocity: null,
      note: "Zu wenige Messungen: Für die Gipfelerkennung braucht es mindestens 5 Messungen zwischen 8 und 18 Jahren im Abstand von höchstens 1,5 Jahren.",
    };
  }

  let peakIndex = 0;
  candidates.forEach((point, index) => {
    if (point.smoothed > candidates[peakIndex].smoothed) {
      peakIndex = index;
    }
  });

  const peak = candidates[peakIndex];
  const limit = peak.smoothed * DROP_FACTOR;
  const before = candidates.slice(0, peakIndex);
  const after = candidates.slice(peakIndex + 1);

  const pending = (reason: PeakResult["reason"], note: string): PeakResult => ({
    status: "pending",
    reason,
    highestAge: peak.age,
    age: null,
    velocity: null,
    note,
  });

  if (peak.smoothed < MIN_PEAK_VELOCITY) {
    return pending(
      "no-spurt",
      "Noch kein Wachstumsschub erkennbar: Die Geschwindigkeit liegt unter 6,5 cm/Jahr.",
    );
  }

  if (after.length < 2) {
    return pending(
      "rising",
      "Der höchste Wert liegt bei den letzten Messungen. Eine Bestätigung braucht zwei weitere Messungen.",
    );
  }

  if (!before.some((point) => point.smoothed <= limit)) {
    return pending(
      "no-rise",
      "Der Anstieg wurde nicht beobachtet, der Schub lag möglicherweise vor der ersten Messung.",
    );
  }

  const laterAfter = after.slice(1);
  const laterMean = laterAfter.reduce((sum, point) => sum + point.smoothed, 0) / laterAfter.length;

  if (laterMean > limit) {
    return pending(
      "no-drop",
      "Die Geschwindigkeit sinkt nach dem höchsten Wert noch nicht deutlich.",
    );
  }

  return {
    status: "confirmed",
    reason: "confirmed",
    highestAge: peak.age,
    age: peak.age,
    velocity: peak.smoothed,
    note: "Gipfel der Wachstumsgeschwindigkeit beobachtet.",
  };
}
