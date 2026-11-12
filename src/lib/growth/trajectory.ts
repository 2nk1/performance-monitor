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
  /** Alter beim Wachstumsschub, das die Kurve voraussetzt. */
  impliedPhvAge: number;
  /**
   * false: Die Kurve folgt Zielgröße − Restwachstum und geht dabei genau durch die
   * letzte Messung. true: Nur die Form des Sherar-Verlaufs, auf den Abstand von
   * Messung zu Zielgröße gestreckt (Näherung für den bekannten Typ).
   */
  shaped: boolean;
  /** Größe je Stützstelle von `GrowthTrajectories.ages`. */
  heights: number[];
};

export type GrowthTrajectories = {
  /** Gemeinsames Altersraster ab der letzten Messung bis zum Ende aller Kurven. */
  ages: number[];
  /** Zielgröße, an der alle Kurven enden. */
  target: number;
  /** Nur Typen, die zur letzten Messung passen, und der bekannte Typ. */
  curves: TrajectoryCurve[];
  /** Bekannter Typ, falls seine Kurve berechenbar ist. */
  activeGroup: GrowthMaturity | null;
};

type Candidate = {
  group: GrowthMaturity;
  impliedPhvAge: number;
  shaped: boolean;
  heightAt: (age: number) => number;
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
 *
 * Für den bekannten Typ (beobachtet, festgelegt oder angenommen) gibt es immer
 * eine Fortsetzung: Passt die genaue Kurve nicht, weil Zielgröße und Tabelle von
 * verschiedenen Schätzern stammen, wird die Form seines Verlaufs ab dem
 * bekannten Abstand zum Schub (`knownOffsetYears`) auf die Strecke zur
 * Zielgröße gestreckt.
 */
export function buildTypeTrajectories(input: {
  sex: GrowthSex;
  age: number;
  heightCm: number;
  targetCm: number;
  /** Größter zulässiger Abstand zum Schub; 0 = Schub darf noch nicht passiert sein. */
  maxOffsetYears: number | null;
  knownGroup: GrowthMaturity | null;
  /** Abstand der letzten Messung zum Schub des bekannten Typs (negativ = Schub kommt noch). */
  knownOffsetYears?: number | null;
}): GrowthTrajectories | null {
  const { sex, age, heightCm, targetCm, maxOffsetYears, knownGroup } = input;
  const remaining = targetCm - heightCm;

  if (!(remaining >= 0)) {
    return null;
  }

  const candidates: Candidate[] = GROUPS.flatMap((group) => {
    const offset = sherarOffsetForLeftToGrow(sex, group, remaining);

    if (offset === null) return [];
    if (maxOffsetYears !== null && offset > maxOffsetYears + 1e-9) return [];

    const impliedPhvAge = age - offset;

    // Der Typ muss zum Schubalter passen, das er selbst voraussetzt.
    if (sherarMaturityGroup(sex, impliedPhvAge) !== group) return [];

    return [
      {
        group,
        impliedPhvAge,
        shaped: false,
        heightAt: (current: number) => {
          const left = sherarLeftToGrow(sex, group, current - impliedPhvAge);
          // Nach +4 Jahren ist das Längenwachstum laut Tabelle beendet.
          return left === null ? targetCm : Math.max(heightCm, targetCm - left);
        },
      },
    ];
  });

  const knownOffset = input.knownOffsetYears ?? null;

  if (knownGroup && knownOffset !== null && !candidates.some((c) => c.group === knownGroup)) {
    const offset = Math.min(Math.max(knownOffset, SHERAR_MIN_OFFSET), SHERAR_MAX_OFFSET);
    const leftNow = sherarLeftToGrow(sex, knownGroup, offset);

    if (leftNow !== null && leftNow > 0) {
      candidates.push({
        group: knownGroup,
        impliedPhvAge: age - knownOffset,
        shaped: true,
        heightAt: (current) => {
          const left = sherarLeftToGrow(sex, knownGroup, offset + (current - age));
          const done = left === null ? 1 : 1 - Math.min(left, leftNow) / leftNow;
          return heightCm + remaining * done;
        },
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Ende: Der Verlauf ist 4 Jahre nach dem Schub abgeschlossen.
  const endOf = (candidate: Candidate) =>
    candidate.shaped
      ? age +
        SHERAR_MAX_OFFSET -
        Math.min(Math.max(knownOffset ?? 0, SHERAR_MIN_OFFSET), SHERAR_MAX_OFFSET)
      : candidate.impliedPhvAge + SHERAR_MAX_OFFSET;
  const endAge = Math.max(...candidates.map(endOf));
  const ages: number[] = [];
  for (let current = age; current < endAge - 1e-9; current += GRID_STEP_YEARS) {
    ages.push(current);
  }
  ages.push(Math.max(endAge, age));

  const curves: TrajectoryCurve[] = candidates.map((candidate) => ({
    group: candidate.group,
    impliedPhvAge: candidate.impliedPhvAge,
    shaped: candidate.shaped,
    heights: ages.map((current, index) => (index === 0 ? heightCm : candidate.heightAt(current))),
  }));

  return {
    ages,
    target: targetCm,
    curves,
    activeGroup: curves.some((curve) => curve.group === knownGroup) ? knownGroup : null,
  };
}

export type MirwaldCurve = {
  /** Altersraster ab der letzten Messung. */
  ages: number[];
  heights: number[];
  /** Mirwald/Sherar-Zielgröße, bei der die Kurve endet. */
  target: number;
  group: GrowthMaturity;
  /**
   * error: Fehlerbereich der Prognose (95 %), öffnet sich von 0 am Messpunkt bis
   * zur vollen Breite am Ende; nur bei beobachtetem Schub.
   * types: Spanne der Typen, die zu Messung und Zielgröße passen ("wenn Typ so,
   * dann so"), ohne Versprechen einer Linie.
   */
  band: { kind: "error" | "types"; lo: number[]; hi: number[] } | null;
};

/** Linear interpolierter Wert, vor dem Anfang der erste, nach dem Ende der letzte. */
function valueAt(ages: number[], values: number[], age: number): number {
  const last = ages.length - 1;

  if (age <= ages[0]) return values[0];
  if (age >= ages[last]) return values[last];

  const upper = ages.findIndex((candidate) => candidate >= age);
  const t = (age - ages[upper - 1]) / (ages[upper] - ages[upper - 1]);

  return values[upper - 1] + (values[upper] - values[upper - 1]) * t;
}

/**
 * Verlaufskurve zur Mirwald/Sherar-Zielgröße: ab der letzten Messung
 * Zielgröße − Restwachstum(Typ, Abstand zum Schub + Δt), so gestreckt, dass sie
 * genau am Messpunkt startet. Die Sherar-Tabelle wird linear interpoliert.
 *
 * Das Band hängt an der Datengrundlage: Bei beobachtetem Schub gilt der
 * Fehlerbereich der Methode, der am Messpunkt null ist und sich zur Zielgröße
 * hin öffnet. Sonst gibt es keinen belegten Fehlerbereich, das Band zeigt dann
 * die Spanne der zum Ergebnis passenden Typen.
 */
export function buildMirwaldCurve(input: {
  sex: GrowthSex;
  age: number;
  heightCm: number;
  targetCm: number;
  group: GrowthMaturity;
  /** Abstand der letzten Messung zum Schub (negativ = Schub kommt noch). */
  offsetYears: number;
  source: "observed" | "group" | "estimate";
  errorCm: number;
  maxOffsetYears: number | null;
}): MirwaldCurve | null {
  const { sex, age, heightCm, targetCm, group, offsetYears, source } = input;
  const remaining = targetCm - heightCm;
  const offset = Math.min(Math.max(offsetYears, SHERAR_MIN_OFFSET), SHERAR_MAX_OFFSET);
  const leftNow = sherarLeftToGrow(sex, group, offset);

  if (!(remaining > 0) || leftNow === null || leftNow <= 0) {
    return null;
  }

  const fractionDone = (current: number) => {
    const left = sherarLeftToGrow(sex, group, offset + (current - age));
    return left === null ? 1 : 1 - Math.min(left, leftNow) / leftNow;
  };
  const ownEnd = age + SHERAR_MAX_OFFSET - offset;

  const types =
    source === "observed"
      ? null
      : buildTypeTrajectories({
          sex,
          age,
          heightCm,
          targetCm,
          maxOffsetYears: input.maxOffsetYears,
          knownGroup: source === "group" ? group : null,
          knownOffsetYears: source === "group" ? offsetYears : null,
        });

  const endAge = Math.max(ownEnd, types?.ages.at(-1) ?? 0);
  const ages: number[] = [];
  for (let current = age; current < endAge - 1e-9; current += GRID_STEP_YEARS) {
    ages.push(current);
  }
  ages.push(Math.max(endAge, age));

  const heights = ages.map((current, index) =>
    index === 0 ? heightCm : heightCm + remaining * fractionDone(current),
  );

  let band: MirwaldCurve["band"] = null;

  if (source === "observed") {
    const fan = ages.map((current) => input.errorCm * fractionDone(current));
    band = {
      kind: "error",
      lo: heights.map((height, index) => height - fan[index]),
      hi: heights.map((height, index) => height + fan[index]),
    };
  } else if (types && types.curves.length > 1) {
    const others = types.curves.map((curve) =>
      ages.map((current) => valueAt(types.ages, curve.heights, current)),
    );
    band = {
      kind: "types",
      lo: heights.map((height, index) => Math.min(height, ...others.map((row) => row[index]))),
      hi: heights.map((height, index) => Math.max(height, ...others.map((row) => row[index]))),
    };
  }

  return { ages, heights, target: targetCm, group, band };
}
