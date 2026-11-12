import {
  SHERAR_LEFT_TO_GROW_CM,
  SHERAR_MAX_OFFSET,
  SHERAR_MIN_OFFSET,
  SHERAR_STEP,
  sherarLeftToGrow,
  sherarMaturityGroup,
} from "@/lib/growth/mirwald-sherar";
import type { GrowthMaturity, GrowthSex } from "@/lib/types";

const GROUPS: GrowthMaturity[] = ["early", "average", "late"];
const GRID_STEP_YEARS = 0.5;

/**
 * Abstand zum Wachstumsschub (Jahre), bei dem Sherars Restwachstum für die
 * Gruppe genau `remainingCm` beträgt (Umkehrung von `sherarLeftToGrow`).
 * Das Restwachstum fällt mit dem Abstand, am Ende der Tabelle steht eine Null-
 * Strecke: dort zählt der früheste Abstand. Null, wenn mehr Wachstum übrig ist
 * als bei −4 Jahren oder die Zielgröße unter der aktuellen Größe liegt.
 */
export function sherarOffsetForLeftToGrow(
  sex: GrowthSex,
  group: GrowthMaturity,
  remainingCm: number,
): number | null {
  const rows = SHERAR_LEFT_TO_GROW_CM[sex][group];

  if (!Number.isFinite(remainingCm) || remainingCm < 0 || remainingCm > rows[0] + 1e-9) {
    return null;
  }

  const first = rows.findIndex((value) => value <= remainingCm + 1e-9);

  if (first <= 0) {
    return SHERAR_MIN_OFFSET;
  }

  const upper = rows[first - 1];
  const lower = rows[first];
  const fraction = upper === lower ? 1 : (upper - remainingCm) / (upper - lower);

  return SHERAR_MIN_OFFSET + SHERAR_STEP * (first - 1 + fraction);
}

export type TrajectoryCurve = {
  group: GrowthMaturity;
  /** Alter beim Wachstumsschub, das die Kurve durch die letzte Messung zur Zielgröße führt. */
  impliedPhvAge: number;
  /** Größe je Stützstelle von `GrowthTrajectories.ages`. */
  heights: number[];
};

export type GrowthTrajectories = {
  /** Gemeinsames Altersraster ab der letzten Messung bis zum Ende aller Kurven. */
  ages: number[];
  /** Zielgröße, an der alle Kurven enden. */
  target: number;
  /** Nur Typen, die zur letzten Messung passen. */
  curves: TrajectoryCurve[];
  /** Bekannter Typ, falls seine Kurve berechenbar ist. */
  activeGroup: GrowthMaturity | null;
};

/**
 * Wachstumsverläufe je Entwicklungstyp (Sherar et al. 2005): Die Kurve folgt
 * Zielgröße − Restwachstum(Typ, Abstand zum Schub). Der Schubzeitpunkt wird je
 * Typ so gewählt, dass die Kurve durch die letzte Messung geht und bei der
 * Zielgröße endet. Alle Typen teilen also Start und Ende und unterscheiden sich
 * nur im Tempo dazwischen. Das zeigt den zeitlichen Verlauf, nicht die
 * Unsicherheit der Zielgröße.
 *
 * Verworfen wird ein Typ, wenn
 * - die Messung außerhalb dessen liegt, was seine Tabelle (±4 Jahre um den
 *   Schub) erklären kann,
 * - das abgeleitete Schubalter nicht in sein Altersband fällt, oder
 * - der Schub rechnerisch schon vorbei wäre (`maxOffsetYears`), obwohl die
 *   Messungen das nicht zeigen.
 */
export function buildTypeTrajectories(input: {
  sex: GrowthSex;
  age: number;
  heightCm: number;
  targetCm: number;
  /** Größter zulässiger Abstand zum Schub; 0 = Schub darf noch nicht passiert sein. */
  maxOffsetYears: number | null;
  knownGroup: GrowthMaturity | null;
}): GrowthTrajectories | null {
  const { sex, age, heightCm, targetCm, maxOffsetYears, knownGroup } = input;
  const remaining = targetCm - heightCm;

  if (!(remaining >= 0)) {
    return null;
  }

  const fitted = GROUPS.flatMap((group) => {
    const offset = sherarOffsetForLeftToGrow(sex, group, remaining);

    if (offset === null) return [];
    if (maxOffsetYears !== null && offset > maxOffsetYears + 1e-9) return [];

    const impliedPhvAge = age - offset;

    // Der Typ muss zum Schubalter passen, das er selbst voraussetzt.
    if (sherarMaturityGroup(sex, impliedPhvAge) !== group) return [];

    return [{ group, impliedPhvAge, offset }];
  });

  if (fitted.length === 0) {
    return null;
  }

  const endAge = Math.max(...fitted.map((curve) => curve.impliedPhvAge + SHERAR_MAX_OFFSET));
  const ages: number[] = [];
  for (let current = age; current < endAge - 1e-9; current += GRID_STEP_YEARS) {
    ages.push(current);
  }
  ages.push(Math.max(endAge, age));

  const curves: TrajectoryCurve[] = fitted.map(({ group, impliedPhvAge }) => ({
    group,
    impliedPhvAge,
    heights: ages.map((current, index) => {
      if (index === 0) return heightCm;
      const left = sherarLeftToGrow(sex, group, current - impliedPhvAge);
      // Nach +4 Jahren ist das Längenwachstum laut Tabelle beendet.
      return left === null ? targetCm : Math.max(heightCm, targetCm - left);
    }),
  }));

  return {
    ages,
    target: targetCm,
    curves,
    activeGroup: curves.some((curve) => curve.group === knownGroup) ? knownGroup : null,
  };
}
