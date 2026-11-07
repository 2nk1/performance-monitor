import { ageInYears } from "@/lib/growth/analysis";
import { referenceCurve } from "@/lib/growth/percentiles";
import type { GrowthComparisonAthlete, GrowthSex } from "@/lib/types";

/** Obergrenze, damit die Linien im Chart unterscheidbar bleiben. */
export const MAX_GROWTH_COMPARISON_SERIES = 9;

/** Feste Reihenfolge der Geschlechter, damit Bänder/Legende stabil sortiert sind. */
const SEX_ORDER: GrowthSex[] = ["male", "female"];

export const sexLabels: Record<GrowthSex, string> = {
  male: "Jungen",
  female: "Mädchen",
};

/**
 * Eine Zeile im Recharts-Datensatz. Personen-Werte liegen unter `p<index>`
 * (Index = Position in der Auswahl = Farbindex), Referenzbänder je
 * Geschlecht unter `band_<sex>` / `median_<sex>`. Index statt ID als
 * Schlüssel, weil UUIDs mit Bindestrichen als `dataKey` unhandlich sind.
 */
export type GrowthComparisonRow = {
  age: number;
  [key: string]: number | [number, number] | undefined;
};

export type GrowthComparisonData = {
  rows: GrowthComparisonRow[];
  series: { key: string; athlete: GrowthComparisonAthlete }[];
  /** Geschlechter in der Auswahl, in fester Reihenfolge. */
  sexes: GrowthSex[];
  xDomain: [number, number];
  yDomain: [number, number];
};

export const seriesKey = (index: number) => `p${index}`;
export const bandKey = (sex: GrowthSex) => `band_${sex}`;
export const medianKey = (sex: GrowthSex) => `median_${sex}`;

/**
 * Baut den Datensatz für die Überlagerung: eine Linie je Person (Größe über
 * dezimalem Alter) plus das KiGGS-Band P3 bis P97 für jedes in der Auswahl
 * vorkommende Geschlecht.
 */
export function buildGrowthComparisonData(
  athletes: GrowthComparisonAthlete[],
): GrowthComparisonData | null {
  const selected = athletes.slice(0, MAX_GROWTH_COMPARISON_SERIES);
  const rowsByAge = new Map<number, GrowthComparisonRow>();
  const rowAt = (age: number) => {
    // Auf Tage runden, damit Messungen am selben Alter in einer Zeile landen.
    const key = Math.round(age * 1000) / 1000;
    let row = rowsByAge.get(key);

    if (!row) {
      row = { age: key };
      rowsByAge.set(key, row);
    }

    return row;
  };

  const series = selected.map((athlete, index) => ({ key: seriesKey(index), athlete }));
  const ages: number[] = [];
  const heights: number[] = [];

  series.forEach(({ key, athlete }) => {
    athlete.measurements.forEach((measurement) => {
      const age = ageInYears(athlete.birth_date, measurement.measured_at);
      rowAt(age)[key] = measurement.height_cm;
      ages.push(age);
      heights.push(measurement.height_cm);
    });
  });

  if (ages.length === 0) {
    return null;
  }

  const xDomain: [number, number] = [
    Math.max(0, Math.floor(Math.min(...ages)) - 1),
    Math.ceil(Math.max(...ages)) + 1,
  ];

  const sexes = SEX_ORDER.filter((sex) => selected.some((athlete) => athlete.sex === sex));
  const referenceValues: number[] = [];

  sexes.forEach((sex) => {
    referenceCurve(sex, xDomain[0], xDomain[1]).forEach((point) => {
      const row = rowAt(point.age);
      row[bandKey(sex)] = [point.p3, point.p97];
      row[medianKey(sex)] = point.p50;
      referenceValues.push(point.p3, point.p97);
    });
  });

  const allValues = [...heights, ...referenceValues];
  const yDomain: [number, number] = [
    Math.floor((Math.min(...allValues) - 5) / 10) * 10,
    Math.ceil((Math.max(...allValues) + 3) / 10) * 10,
  ];

  return {
    rows: [...rowsByAge.values()].sort((a, b) => a.age - b.age),
    series,
    sexes,
    xDomain,
    yDomain,
  };
}

/** Liest die Auswahl aus `?ids=a,b,c`, verwirft Unbekannte/Duplikate und kappt auf das Maximum. */
export function parseSelectedIds(param: string | null, knownIds: Set<string>): string[] {
  if (!param) {
    return [];
  }

  return [...new Set(param.split(","))]
    .filter((id) => knownIds.has(id))
    .slice(0, MAX_GROWTH_COMPARISON_SERIES);
}
