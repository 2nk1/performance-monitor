import type { GrowthSex } from "@/lib/types";

/**
 * Khamis-Roche-Methode zur Prognose der Erwachsenengröße ohne Knochenalter.
 *
 * Quelle: Khamis HJ, Roche AF. Predicting adult stature without using
 * skeletal age: the Khamis-Roche method. Pediatrics 1994;94(4):504–507,
 * korrigierte Koeffizienten laut Erratum Pediatrics 1995;95(3):457.
 *
 * Die Regression ist in imperialen Einheiten definiert:
 *   Endgröße [in] = b0 + b1 · Größe [in] + b2 · Gewicht [lb] + b3 · Mittlere Elterngröße [in]
 * Die mittlere Elterngröße ist hier der einfache Mittelwert beider Eltern
 * (KEIN ±6,5-cm-Geschlechtsausgleich, der steckt bereits in den Koeffizienten).
 *
 * Tabelle: Alter in Halbjahresschritten von 4,0 bis 17,5 Jahren.
 * Spalten: [Alter, b0, b1 (Größe), b2 (Gewicht), b3 (Elterngröße)]
 */
type CoefficientRow = readonly [age: number, b0: number, b1: number, b2: number, b3: number];

export const KHAMIS_ROCHE_COEFFICIENTS: Record<GrowthSex, readonly CoefficientRow[]> = {
  male: [
    [4.0, -10.2567, 1.23812, -0.087235, 0.50286],
    [4.5, -10.719, 1.15964, -0.074454, 0.52887],
    [5.0, -11.0213, 1.10674, -0.064778, 0.53919],
    [5.5, -11.1556, 1.0748, -0.05776, 0.53691],
    [6.0, -11.1138, 1.05923, -0.052947, 0.52513],
    [6.5, -11.0221, 1.05542, -0.049892, 0.50692],
    [7.0, -10.9984, 1.05877, -0.048144, 0.48538],
    [7.5, -11.0214, 1.06467, -0.047256, 0.46361],
    [8.0, -11.0696, 1.06853, -0.046778, 0.44469],
    [8.5, -11.122, 1.06572, -0.046261, 0.43171],
    [9.0, -11.1571, 1.05166, -0.045254, 0.42776],
    [9.5, -11.1405, 1.02174, -0.043311, 0.43593],
    [10.0, -11.038, 0.97135, -0.039981, 0.45932],
    [10.5, -10.8286, 0.89589, -0.034814, 0.50101],
    [11.0, -10.4917, 0.81239, -0.02905, 0.54781],
    [11.5, -10.0065, 0.74134, -0.024167, 0.58409],
    [12.0, -9.3522, 0.68325, -0.020076, 0.60927],
    [12.5, -8.6055, 0.63869, -0.016681, 0.62279],
    [13.0, -7.8632, 0.60818, -0.013895, 0.62407],
    [13.5, -7.1348, 0.59228, -0.011624, 0.61253],
    [14.0, -6.4299, 0.59151, -0.009776, 0.58762],
    [14.5, -5.7578, 0.60643, -0.008261, 0.54875],
    [15.0, -5.1282, 0.63757, -0.006988, 0.49536],
    [15.5, -4.5092, 0.68548, -0.005863, 0.42687],
    [16.0, -3.9292, 0.75069, -0.004795, 0.34271],
    [16.5, -3.4873, 0.83375, -0.003695, 0.24231],
    [17.0, -3.283, 0.9352, -0.00247, 0.1251],
    [17.5, -3.4156, 1.05558, -0.001027, -0.0095],
  ],
  female: [
    [4.0, -8.1325, 1.24768, -0.19435, 0.44774],
    [4.5, -6.47656, 1.22177, -0.18519, 0.41381],
    [5.0, -5.13582, 1.19932, -0.1753, 0.38467],
    [5.5, -4.13791, 1.1788, -0.16484, 0.36039],
    [6.0, -3.51039, 1.15866, -0.154, 0.34105],
    [6.5, -3.14322, 1.13737, -0.14294, 0.32672],
    [7.0, -2.87645, 1.11342, -0.13184, 0.31748],
    [7.5, -2.66291, 1.08525, -0.12086, 0.3134],
    [8.0, -2.45559, 1.05135, -0.11019, 0.31457],
    [8.5, -2.20728, 1.01018, -0.09999, 0.32105],
    [9.0, -1.87098, 0.9602, -0.09044, 0.33291],
    [9.5, -1.0633, 0.89989, -0.08171, 0.35025],
    [10.0, 0.33468, 0.82771, -0.07397, 0.37312],
    [10.5, 1.97366, 0.74213, -0.06739, 0.40161],
    [11.0, 3.50436, 0.67173, -0.06136, 0.42042],
    [11.5, 4.57747, 0.6415, -0.05518, 0.41686],
    [12.0, 4.84365, 0.64452, -0.04894, 0.3949],
    [12.5, 4.27869, 0.67386, -0.04272, 0.3585],
    [13.0, 3.21417, 0.7226, -0.03661, 0.31163],
    [13.5, 1.83456, 0.78383, -0.03067, 0.25826],
    [14.0, 0.32425, 0.85062, -0.025, 0.20235],
    [14.5, -1.13224, 0.91605, -0.01967, 0.14787],
    [15.0, -2.35055, 0.97319, -0.01477, 0.0988],
    [15.5, -3.10326, 1.01514, -0.01037, 0.05909],
    [16.0, -3.17885, 1.03496, -0.00655, 0.03272],
    [16.5, -2.41657, 1.02573, -0.0034, 0.02364],
    [17.0, -0.65579, 0.98054, -0.001, 0.03584],
    [17.5, 2.26429, 0.89246, 0.00057, 0.07327],
  ],
};

/** 90-%-Fehlergrenzen laut Khamis & Roche (1994), umgerechnet in cm. */
export const KHAMIS_ROCHE_ERROR_90_CM: Record<GrowthSex, number> = {
  male: 5.3,
  female: 4.3,
};

export const KHAMIS_ROCHE_MIN_AGE = 4;
export const KHAMIS_ROCHE_MAX_AGE = 17.5;

const CM_PER_INCH = 2.54;
const LB_PER_KG = 2.2046226218;

/**
 * Koeffizienten für ein exaktes Alter. Die Originaltabelle hat
 * Halbjahresschritte; zwischen zwei Zeilen wird linear interpoliert, damit
 * die Prognose nicht an Halbjahresgrenzen springt.
 */
export function khamisRocheCoefficientsAt(sex: GrowthSex, age: number) {
  const rows = KHAMIS_ROCHE_COEFFICIENTS[sex];

  if (!Number.isFinite(age) || age < KHAMIS_ROCHE_MIN_AGE || age > KHAMIS_ROCHE_MAX_AGE) {
    return null;
  }

  const index = Math.min(Math.floor((age - KHAMIS_ROCHE_MIN_AGE) / 0.5), rows.length - 1);
  const lower = rows[index];
  const upper = rows[Math.min(index + 1, rows.length - 1)];
  const t = upper[0] === lower[0] ? 0 : (age - lower[0]) / (upper[0] - lower[0]);
  const lerp = (i: 1 | 2 | 3 | 4) => lower[i] + (upper[i] - lower[i]) * t;

  return { b0: lerp(1), b1: lerp(2), b2: lerp(3), b3: lerp(4) };
}

export function predictKhamisRoche(input: {
  sex: GrowthSex;
  age: number;
  heightCm: number;
  weightKg: number;
  motherHeightCm: number;
  fatherHeightCm: number;
}): number | null {
  const coefficients = khamisRocheCoefficientsAt(input.sex, input.age);

  if (!coefficients) {
    return null;
  }

  const heightIn = input.heightCm / CM_PER_INCH;
  const weightLb = input.weightKg * LB_PER_KG;
  const midParentIn = (input.motherHeightCm + input.fatherHeightCm) / 2 / CM_PER_INCH;

  const predictedIn =
    coefficients.b0 +
    coefficients.b1 * heightIn +
    coefficients.b2 * weightLb +
    coefficients.b3 * midParentIn;

  return predictedIn * CM_PER_INCH;
}
