import type { GrowthMaturity, GrowthSex } from "@/lib/types";

/**
 * Grenzen für früh/normal/spät anhand des beobachteten Alters beim
 * Wachstumsschub (Age at Peak Height Velocity, APHV).
 *
 * Quelle: Kozieł SM, Malina RM. Modified maturity offset prediction
 * equations: validation in independent longitudinal samples of boys and
 * girls. Sports Med 2018;48:221–236. Frühentwickler: APHV < 13,1 (Jungen)
 * bzw. < 10,9 (Mädchen); Spätentwickler: APHV > 15,1 bzw. > 12,9.
 */
export const PHV_TIMING_THRESHOLDS: Record<GrowthSex, { early: number; late: number }> = {
  male: { early: 13.1, late: 15.1 },
  female: { early: 10.9, late: 12.9 },
};

export const timingLabels: Record<GrowthMaturity, string> = {
  early: "Frühentwickler",
  average: "Normal entwickelt",
  late: "Spätentwickler",
};

export function classifyPhvTiming(sex: GrowthSex, phvAge: number): GrowthMaturity {
  const { early, late } = PHV_TIMING_THRESHOLDS[sex];

  if (phvAge < early) return "early";
  if (phvAge > late) return "late";
  return "average";
}
