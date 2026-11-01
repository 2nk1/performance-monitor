import { KIGGS_HEIGHT, KIGGS_MAX_AGE } from "@/lib/growth/reference/kiggs-height";
import type { GrowthSex } from "@/lib/types";

/** z-Wert der 97. (bzw. 3.) Perzentile einer Normalverteilung. */
const Z_P97 = 1.8808;

export type ReferencePoint = { p3: number; p50: number; p97: number };

type Column = { xs: number[]; ys: number[]; tangents: number[] };

/** Tangenten für eine monotone kubische Interpolation (Fritsch–Carlson / PCHIP). */
function buildTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const d = h.map((step, i) => (ys[i + 1] - ys[i]) / step);
  const m = new Array<number>(n).fill(0);

  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }

  const endTangent = (h0: number, h1: number, d0: number, d1: number) => {
    const value = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);

    if (Math.sign(value) !== Math.sign(d0)) {
      return 0;
    }

    if (Math.sign(d0) !== Math.sign(d1) && Math.abs(value) > 3 * Math.abs(d0)) {
      return 3 * d0;
    }

    return value;
  };

  m[0] = endTangent(h[0], h[1], d[0], d[1]);
  m[n - 1] = endTangent(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);

  return m;
}

const columnCache = new Map<string, Column>();

function column(sex: GrowthSex, index: 1 | 2 | 3): Column {
  const key = `${sex}-${index}`;
  const cached = columnCache.get(key);

  if (cached) {
    return cached;
  }

  const rows = KIGGS_HEIGHT[sex];
  const xs = rows.map((row) => row[0]);
  const ys = rows.map((row) => row[index]);
  const built = { xs, ys, tangents: buildTangents(xs, ys) };
  columnCache.set(key, built);

  return built;
}

function interpolate({ xs, ys, tangents }: Column, x: number): number {
  let k = xs.findIndex((value) => value > x) - 1;

  if (k < 0) {
    k = xs.length - 2;
  }

  const step = xs[k + 1] - xs[k];
  const t = (x - xs[k]) / step;
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    (2 * t3 - 3 * t2 + 1) * ys[k] +
    (t3 - 2 * t2 + t) * step * tangents[k] +
    (-2 * t3 + 3 * t2) * ys[k + 1] +
    (t3 - t2) * step * tangents[k + 1]
  );
}

/** Referenzwerte (P3, P50, P97) für ein Alter; `null` außerhalb von 0 bis 18 Jahren. */
export function referenceAt(sex: GrowthSex, age: number): ReferencePoint | null {
  if (!Number.isFinite(age) || age < 0 || age > KIGGS_MAX_AGE) {
    return null;
  }

  return {
    p3: interpolate(column(sex, 1), age),
    p50: interpolate(column(sex, 2), age),
    p97: interpolate(column(sex, 3), age),
  };
}

/**
 * Abstand zum Median in Standardabweichungen. Die Referenz liefert nur P3,
 * P50 und P97, daher wird unterhalb und oberhalb des Medians je eine eigene
 * Streuung aus dem Abstand zur 3. bzw. 97. Perzentile angesetzt. Das ist eine
 * gute Näherung, weil die Körpergröße nahezu normalverteilt ist.
 */
export function heightZScore(sex: GrowthSex, age: number, heightCm: number): number | null {
  const reference = referenceAt(sex, age);

  if (!reference) {
    return null;
  }

  return heightCm >= reference.p50
    ? ((heightCm - reference.p50) / (reference.p97 - reference.p50)) * Z_P97
    : ((heightCm - reference.p50) / (reference.p50 - reference.p3)) * Z_P97;
}

/** Standardnormalverteilung, Näherung der Fehlerfunktion (Abramowitz/Stegun 7.1.26). */
function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-x * x);

  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Perzentile (0 bis 100) der Körpergröße im Vergleich zur KiGGS-Referenz. */
export function heightPercentile(sex: GrowthSex, age: number, heightCm: number): number | null {
  const z = heightZScore(sex, age, heightCm);

  return z === null ? null : normalCdf(z) * 100;
}

/** Perzentil als Text: ganze Zahlen, ganz außen „<1“ bzw. „>99“. */
export function formatPercentile(percentile: number): string {
  if (percentile < 1) return "<1";
  if (percentile > 99) return ">99";

  return String(Math.round(percentile));
}

/** Referenzkurven (P3, P50, P97) in gleichmäßigen Altersschritten, auf 0 bis 18 Jahre begrenzt. */
export function referenceCurve(
  sex: GrowthSex,
  fromAge: number,
  toAge: number,
  step = 0.25,
): ({ age: number } & ReferencePoint)[] {
  const result: ({ age: number } & ReferencePoint)[] = [];
  const start = Math.max(0, fromAge);
  const end = Math.min(KIGGS_MAX_AGE, toAge);

  for (let age = Math.ceil(start / step) * step; age <= end + 1e-9; age += step) {
    const reference = referenceAt(sex, age);

    if (reference) {
      result.push({ age, ...reference });
    }
  }

  return result;
}

/**
 * Mittlere Wachstumsrate der Referenz in cm pro Jahr: Differenz der
 * Mediankurve über ein Jahr (Alter ± 0,5). Das ist eine grobe Orientierung:
 * Die Referenz stammt aus einer Querschnittserhebung und glättet den Schub,
 * die Spitzenrate einzelner Kinder liegt deutlich höher.
 */
export function referenceVelocity(sex: GrowthSex, age: number): number | null {
  const before = referenceAt(sex, age - 0.5);
  const after = referenceAt(sex, age + 0.5);

  return before && after ? after.p50 - before.p50 : null;
}
