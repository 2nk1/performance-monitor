const DAYS_PER_YEAR = 365.25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Dezimales Alter in Jahren zwischen zwei ISO-Daten (YYYY-MM-DD). */
export function ageInYears(birthDate: string, date: string): number {
  const birth = Date.parse(`${birthDate}T00:00:00Z`);
  const at = Date.parse(`${date}T00:00:00Z`);
  return (at - birth) / MS_PER_DAY / DAYS_PER_YEAR;
}
