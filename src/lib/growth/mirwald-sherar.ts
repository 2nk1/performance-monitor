import type { GrowthMaturity, GrowthSex } from "@/lib/types";

/**
 * Zielgröße nach Mirwald/Sherar: aktuelle Größe plus das Restwachstum, das
 * Kinder mit gleichem Abstand zum Wachstumsschub im Mittel noch vor sich haben.
 *
 * Schritt 1, Maturity Offset (Jahre relativ zum Wachstumsschub, PHV):
 * Mirwald RL, Baxter-Jones ADG, Bailey DA, Beunen GP. An assessment of
 * maturity from anthropometric measurements. Med Sci Sports Exerc
 * 2002;34(4):689–694. Beinlänge = Größe − Sitzhöhe, Längen in cm, Gewicht in
 * kg, Gewicht/Größe-Verhältnis × 100. Standardfehler ca. 0,6 Jahre.
 *
 * Schritt 2, Restwachstum: Sherar LB, Mirwald RL, Baxter-Jones ADG, Thomis M.
 * Prediction of adult height using maturity-based cumulative height velocity
 * curves. J Pediatr 2005;147(4):508–514, Tabelle II.
 */
export function mirwaldMaturityOffset(input: {
  sex: GrowthSex;
  age: number;
  heightCm: number;
  sittingHeightCm: number;
  weightKg: number;
}): number {
  const { sex, age, heightCm, sittingHeightCm, weightKg } = input;
  const legLengthCm = heightCm - sittingHeightCm;
  const weightHeightRatio = (weightKg / heightCm) * 100;

  if (sex === "male") {
    return (
      -9.236 +
      0.0002708 * (legLengthCm * sittingHeightCm) -
      0.001663 * (age * legLengthCm) +
      0.007216 * (age * sittingHeightCm) +
      0.02292 * weightHeightRatio
    );
  }

  return (
    -9.376 +
    0.0001882 * (legLengthCm * sittingHeightCm) +
    0.0022 * (age * legLengthCm) +
    0.005841 * (age * sittingHeightCm) -
    0.002658 * (age * weightKg) +
    0.07693 * weightHeightRatio
  );
}

/**
 * Mittleres Alter beim Wachstumsschub laut Sherar et al. (2005). Wer mehr als
 * ein Jahr davor liegt, gilt dort als Früh-, wer mehr als ein Jahr danach
 * liegt, als Spätentwickler.
 */
export const SHERAR_MEAN_PHV_AGE: Record<GrowthSex, number> = { male: 14, female: 12 };

export function sherarMaturityGroup(sex: GrowthSex, ageAtPhv: number): GrowthMaturity {
  const difference = ageAtPhv - SHERAR_MEAN_PHV_AGE[sex];

  if (difference < -1) return "early";
  if (difference > 1) return "late";
  return "average";
}

/** Mittleres Schubalter je Gruppe laut Sherar et al. (2005), Tabelle I. */
export const SHERAR_GROUP_PHV_AGE: Record<GrowthSex, Record<GrowthMaturity, number>> = {
  male: { early: 12.33, average: 13.85, late: 15.26 },
  female: { early: 10.3, average: 11.58, late: 12.92 },
};

export const SHERAR_MIN_OFFSET = -4;
export const SHERAR_MAX_OFFSET = 4;
export const SHERAR_STEP = 0.2;

/** 95-%-Fehlergrenzen laut Sherar et al. (2005) in cm. */
export const SHERAR_ERROR_95_CM: Record<GrowthSex, number> = { male: 5.35, female: 6.81 };

/**
 * Sherar et al. (2005), Tabelle II: Restwachstum in cm je Abstand zum
 * Wachstumsschub, von −4,0 bis +4,0 Jahren in Schritten von 0,2 Jahren.
 */
export const SHERAR_LEFT_TO_GROW_CM: Record<
  GrowthSex,
  Record<GrowthMaturity, readonly number[]>
> = {
  male: {
    early: [
      45.29, 44.21, 43.11, 41.99, 40.85, 39.69, 38.52, 37.33, 36.15, 34.97, 33.8, 32.62, 31.44,
      30.23, 28.98, 27.66, 26.24, 24.68, 22.96, 21.07, 19.04, 16.96, 14.92, 13.01, 11.26, 9.7, 8.33,
      7.11, 6.04, 5.1, 4.26, 3.52, 2.86, 2.29, 1.78, 1.34, 0.96, 0.64, 0.37, 0.16, 0,
    ],
    average: [
      40.09, 39.08, 38.07, 37.06, 36.05, 35.04, 34.04, 33.05, 32.06, 31.07, 30.06, 29.03, 27.95,
      26.83, 25.63, 24.36, 22.99, 21.51, 19.88, 18.09, 16.16, 14.21, 12.35, 10.65, 9.12, 7.78, 6.59,
      5.54, 4.62, 3.8, 3.09, 2.48, 1.96, 1.52, 1.16, 0.87, 0.63, 0.43, 0.27, 0.12, 0,
    ],
    late: [
      34.73, 33.83, 32.94, 32.05, 31.16, 30.27, 29.38, 28.49, 27.6, 26.7, 25.77, 24.79, 23.74,
      22.63, 21.45, 20.22, 18.96, 17.68, 16.31, 14.76, 13.05, 11.32, 9.71, 8.27, 6.94, 5.7, 4.54,
      3.51, 2.64, 1.92, 1.35, 0.91, 0.58, 0.32, 0.13, 0, 0, 0, 0, 0, 0,
    ],
  },
  female: {
    early: [
      42.61, 41.49, 40.39, 39.3, 38.21, 37.13, 36.04, 34.94, 33.82, 32.68, 31.53, 30.44, 29.36,
      28.24, 27.09, 25.87, 24.54, 23.09, 21.5, 19.77, 17.94, 16.09, 14.3, 12.64, 11.11, 9.69, 8.39,
      7.2, 6.14, 5.19, 4.36, 3.63, 2.99, 2.42, 1.92, 1.47, 1.07, 0.72, 0.43, 0.19, 0,
    ],
    average: [
      38.81, 37.67, 36.55, 35.44, 34.34, 33.25, 32.16, 31.04, 29.91, 28.76, 27.58, 26.39, 25.21,
      24.03, 22.85, 21.66, 20.44, 19.16, 17.8, 16.33, 14.75, 13.13, 11.56, 10.11, 8.77, 7.52, 6.37,
      5.33, 4.42, 3.64, 2.99, 2.45, 1.99, 1.6, 1.26, 0.96, 0.69, 0.46, 0.26, 0.11, 0,
    ],
    late: [
      34.35, 33.27, 32.2, 31.14, 30.09, 29.04, 27.99, 26.93, 25.87, 24.79, 23.71, 22.63, 21.55,
      20.47, 19.37, 18.25, 17.07, 15.81, 14.44, 12.94, 11.36, 9.81, 8.42, 7.2, 6.12, 5.13, 4.24,
      3.46, 2.8, 2.25, 1.82, 1.46, 1.18, 0.94, 0.74, 0.57, 0.41, 0.28, 0.17, 0.08, 0,
    ],
  },
};

/**
 * Restwachstum für einen Abstand zum Wachstumsschub. Zwischen zwei
 * Tabellenzeilen wird linear interpoliert; außerhalb von ±4 Jahren gibt es
 * keine Referenzwerte.
 */
export function sherarLeftToGrow(
  sex: GrowthSex,
  group: GrowthMaturity,
  offsetYears: number,
): number | null {
  if (
    !Number.isFinite(offsetYears) ||
    offsetYears < SHERAR_MIN_OFFSET ||
    offsetYears > SHERAR_MAX_OFFSET
  ) {
    return null;
  }

  const rows = SHERAR_LEFT_TO_GROW_CM[sex][group];
  const position = (offsetYears - SHERAR_MIN_OFFSET) / SHERAR_STEP;
  const index = Math.min(Math.floor(position + 1e-9), rows.length - 1);
  const upper = Math.min(index + 1, rows.length - 1);
  const t = Math.max(0, position - index);

  return rows[index] + (rows[upper] - rows[index]) * t;
}

export type MirwaldSherarResult = {
  offsetYears: number;
  ageAtPhv: number;
  group: GrowthMaturity;
  /**
   * observed: Schubalter aus den Messungen; group: Schub liegt noch vor dem Kind, Alter aus dem
   * Gruppenmittel; estimate: Abstand aus der Mirwald-Gleichung.
   */
  source: "observed" | "group" | "estimate";
  /** null, wenn der Abstand zum Wachstumsschub außerhalb von ±4 Jahren liegt. */
  leftToGrowCm: number | null;
  predictedHeightCm: number | null;
};

/** Prognose, wenn Abstand und Gruppe bereits feststehen (aus Messungen oder Einstufung). */
export function predictFromOffset(input: {
  sex: GrowthSex;
  age: number;
  heightCm: number;
  offsetYears: number;
  group: GrowthMaturity;
  source: MirwaldSherarResult["source"];
}): MirwaldSherarResult {
  const leftToGrowCm = sherarLeftToGrow(input.sex, input.group, input.offsetYears);

  return {
    offsetYears: input.offsetYears,
    ageAtPhv: input.age - input.offsetYears,
    group: input.group,
    source: input.source,
    leftToGrowCm,
    predictedHeightCm: leftToGrowCm === null ? null : input.heightCm + leftToGrowCm,
  };
}

export function predictMirwaldSherar(input: {
  sex: GrowthSex;
  age: number;
  heightCm: number;
  sittingHeightCm: number;
  weightKg: number;
  /** Manuell festgelegter Entwicklungstyp; ersetzt die Einstufung aus dem geschätzten Schubalter. */
  groupOverride?: GrowthMaturity | null;
}): MirwaldSherarResult {
  const offsetYears = mirwaldMaturityOffset(input);
  const group = input.groupOverride ?? sherarMaturityGroup(input.sex, input.age - offsetYears);

  return predictFromOffset({
    sex: input.sex,
    age: input.age,
    heightCm: input.heightCm,
    offsetYears,
    group,
    source: "estimate",
  });
}
