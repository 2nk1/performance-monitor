import {
  KHAMIS_ROCHE_ERROR_90_CM,
  KHAMIS_ROCHE_MAX_AGE,
  KHAMIS_ROCHE_MIN_AGE,
  predictKhamisRoche,
} from "@/lib/growth/khamis-roche";
import type { GrowthMeasurement, GrowthProfile, GrowthSex } from "@/lib/types";

const DAYS_PER_YEAR = 365.25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Dezimales Alter in Jahren zwischen zwei ISO-Daten (YYYY-MM-DD). */
export function ageInYears(birthDate: string, date: string): number {
  const birth = Date.parse(`${birthDate}T00:00:00Z`);
  const at = Date.parse(`${date}T00:00:00Z`);
  return (at - birth) / MS_PER_DAY / DAYS_PER_YEAR;
}

/**
 * Genetische Zielgröße nach Tanner (Mid-Parental Height):
 * (Mutter + Vater ± 13 cm) / 2. Etwa 95 % landen innerhalb ±8,5 cm.
 */
export const MID_PARENT_RANGE_CM = 8.5;

export function midParentTargetHeight(
  sex: GrowthSex,
  motherHeightCm: number,
  fatherHeightCm: number,
): number {
  const adjustment = sex === "male" ? 13 : -13;
  return (motherHeightCm + fatherHeightCm + adjustment) / 2;
}

export type MaturityOffset = {
  /** Jahre relativ zum Wachstumsschub (PHV): negativ = davor, positiv = danach. */
  offsetYears: number;
  /** Geschätztes Alter beim Wachstumsschub (Age at Peak Height Velocity). */
  ageAtPhv: number;
  equation: "Moore-1 (Sitzhöhe)" | "Moore-2 (Größe)" | "Moore (Größe)";
};

/**
 * Maturity Offset nach Moore et al. (2015), Med Sci Sports Exerc 47(8):1755–64.
 * Jungen: bevorzugt Sitzhöhe (Moore-1), sonst Körpergröße (Moore-2).
 * Mädchen: Körpergröße. Standardfehler ca. ±0,5 Jahre; am genauesten nahe
 * am Wachstumsschub, bei sehr frühen/späten Entwicklern systematisch verzerrt.
 */
export function mooreMaturityOffset(input: {
  sex: GrowthSex;
  age: number;
  heightCm: number;
  sittingHeightCm: number | null;
}): MaturityOffset {
  const { sex, age, heightCm, sittingHeightCm } = input;

  let offsetYears: number;
  let equation: MaturityOffset["equation"];

  if (sex === "female") {
    offsetYears = -7.709133 + 0.0042232 * (age * heightCm);
    equation = "Moore (Größe)";
  } else if (sittingHeightCm !== null) {
    offsetYears = -8.128741 + 0.0070346 * (age * sittingHeightCm);
    equation = "Moore-1 (Sitzhöhe)";
  } else {
    offsetYears = -7.999994 + 0.0036124 * (age * heightCm);
    equation = "Moore-2 (Größe)";
  }

  return { offsetYears, ageAtPhv: age - offsetYears, equation };
}

/**
 * Reifestatus über den erreichten Anteil der prognostizierten Endgröße
 * (%PAH), wie im Bio-Banding üblich (Cumming et al. 2017).
 */
export type MaturityStage = "pre-puberty" | "early-puberty" | "mid-puberty" | "late-puberty";

export const maturityStageLabels: Record<MaturityStage, string> = {
  "pre-puberty": "Vorpubertär (< 85 %)",
  "early-puberty": "Frühe Pubertät (85–90 %)",
  "mid-puberty": "Im Wachstumsschub (90–95 %)",
  "late-puberty": "Späte Pubertät (> 95 %)",
};

export function maturityStageFromPah(percent: number): MaturityStage {
  if (percent < 85) return "pre-puberty";
  if (percent < 90) return "early-puberty";
  if (percent < 95) return "mid-puberty";
  return "late-puberty";
}

export type GrowthPoint = GrowthMeasurement & {
  age: number;
  /** Khamis-Roche-Prognose zum Zeitpunkt dieser Messung (falls berechenbar). */
  khamisRoche: number | null;
  /** Erreichter Anteil der Khamis-Roche-Prognose in %. */
  percentPredicted: number | null;
};

export type PredictionModelId = "khamis-roche" | "mid-parent";

export type Prediction = {
  id: PredictionModelId;
  label: string;
  description: string;
  value: number | null;
  /** Unsicherheitsbereich ± in cm. */
  range: number | null;
  /** Fehlende Eingaben, falls `value` null ist. */
  missing: string[];
};

export type GrowthAnalysis = {
  points: GrowthPoint[];
  latest: GrowthPoint | null;
  predictions: Prediction[];
  maturity: (MaturityOffset & { stage: MaturityStage | null }) | null;
  /** Wachstumsrate zwischen den letzten beiden Messungen (cm/Jahr). */
  growthVelocity: number | null;
};

/** Messungen, die weniger als 3 Monate auseinander liegen, ergeben keine sinnvolle Jahresrate. */
const MIN_VELOCITY_INTERVAL_YEARS = 0.25;

export function buildGrowthAnalysis(
  profile: GrowthProfile,
  measurements: GrowthMeasurement[],
): GrowthAnalysis {
  const { sex, birth_date, mother_height_cm, father_height_cm } = profile;
  const hasParents = mother_height_cm !== null && father_height_cm !== null;

  const points: GrowthPoint[] = [...measurements]
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
    .map((measurement) => {
      const age = ageInYears(birth_date, measurement.measured_at);
      const khamisRoche =
        hasParents && measurement.weight_kg !== null
          ? predictKhamisRoche({
              sex,
              age,
              heightCm: measurement.height_cm,
              weightKg: measurement.weight_kg,
              motherHeightCm: mother_height_cm,
              fatherHeightCm: father_height_cm,
            })
          : null;

      return {
        ...measurement,
        age,
        khamisRoche,
        percentPredicted: khamisRoche ? (measurement.height_cm / khamisRoche) * 100 : null,
      };
    });

  const latest = points.at(-1) ?? null;

  const krMissing: string[] = [];
  if (!hasParents) krMissing.push("Größe beider Eltern");
  if (!latest) krMissing.push("Messung");
  else {
    if (latest.weight_kg === null) krMissing.push("Gewicht der letzten Messung");
    if (latest.age < KHAMIS_ROCHE_MIN_AGE || latest.age > KHAMIS_ROCHE_MAX_AGE) {
      krMissing.push(`Alter zwischen ${KHAMIS_ROCHE_MIN_AGE} und ${KHAMIS_ROCHE_MAX_AGE} Jahren`);
    }
  }

  const predictions: Prediction[] = [
    {
      id: "khamis-roche",
      label: "Khamis-Roche",
      description: "Aktuelle Größe, Gewicht, Alter und Elterngröße",
      value: latest?.khamisRoche ?? null,
      range: KHAMIS_ROCHE_ERROR_90_CM[sex],
      missing: latest?.khamisRoche ? [] : krMissing,
    },
    {
      id: "mid-parent",
      label: "Elterngröße (Tanner)",
      description: "Genetische Zielgröße, nur aus der Größe der Eltern",
      value: hasParents ? midParentTargetHeight(sex, mother_height_cm, father_height_cm) : null,
      range: MID_PARENT_RANGE_CM,
      missing: hasParents ? [] : ["Größe beider Eltern"],
    },
  ];

  const maturity = latest
    ? {
        ...mooreMaturityOffset({
          sex,
          age: latest.age,
          heightCm: latest.height_cm,
          sittingHeightCm: latest.sitting_height_cm,
        }),
        stage:
          latest.percentPredicted !== null ? maturityStageFromPah(latest.percentPredicted) : null,
      }
    : null;

  let growthVelocity: number | null = null;
  if (points.length >= 2) {
    const previous = points[points.length - 2];
    const current = points[points.length - 1];
    const years = current.age - previous.age;
    if (years >= MIN_VELOCITY_INTERVAL_YEARS) {
      growthVelocity = (current.height_cm - previous.height_cm) / years;
    }
  }

  return { points, latest, predictions, maturity, growthVelocity };
}
