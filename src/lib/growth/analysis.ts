import {
  KHAMIS_ROCHE_ERROR_90_CM,
  KHAMIS_ROCHE_MAX_AGE,
  KHAMIS_ROCHE_MIN_AGE,
  predictKhamisRoche,
} from "@/lib/growth/khamis-roche";
import {
  SHERAR_ERROR_95_CM,
  SHERAR_GROUP_PHV_AGE,
  predictFromOffset,
  predictMirwaldSherar,
  sherarMaturityGroup,
  type MirwaldSherarResult,
} from "@/lib/growth/mirwald-sherar";
import { ageInYears } from "@/lib/growth/age";
import { buildReachSamples, type ReachTest } from "@/lib/growth/reach";
import { PHV_TIMING_THRESHOLDS, classifyPhvTiming, timingLabels } from "@/lib/growth/timing";
import {
  buildMirwaldCurve,
  buildTypeTrajectories,
  type GrowthTrajectories,
  type MirwaldCurve,
} from "@/lib/growth/trajectory";
import {
  buildVelocitySeries,
  detectPeak,
  type PeakResult,
  type VelocityPoint,
} from "@/lib/growth/velocity";
import type { GrowthMaturity, GrowthMeasurement, GrowthProfile, GrowthSex } from "@/lib/types";

export { ageInYears };

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

export type GrowthPoint = GrowthMeasurement & {
  age: number;
  /** Khamis-Roche-Prognose zum Zeitpunkt dieser Messung (falls berechenbar). */
  khamisRoche: number | null;
  /** Erreichter Anteil der Khamis-Roche-Prognose in %. */
  percentPredicted: number | null;
};

export type PredictionModelId =
  "khamis-roche" | "khamis-roche-adjusted" | "mid-parent" | "mirwald-sherar";

export type Prediction = {
  id: PredictionModelId;
  label: string;
  description: string | null;
  value: number | null;
  /** Unsicherheitsbereich ± in cm. */
  range: number | null;
  /** Datum der Messung, auf der die Prognose beruht (Khamis-Roche, Mirwald/Sherar). */
  basisDate: string | null;
  /** Kurzform der Datengrundlage, nur Mirwald/Sherar ("Schub beobachtet" usw.). */
  basisLabel: string | null;
  /** Fehlende Eingaben, falls `value` null ist. */
  missing: string[];
};

/**
 * Einstufung des Entwicklungstyps.
 * manual: vom Nutzer festgelegt; observed: aus dem beobachteten Gipfel der
 * Wachstumsgeschwindigkeit; presumed: spät, weil trotz dichter Messungen noch
 * kein Gipfel zu sehen ist, obwohl das Alter die Spät-Grenze überschritten hat
 * (der Gipfel liegt dann zwangsläufig danach).
 *
 * Aus der Moore-Schätzung allein wird bewusst nicht eingestuft: Sie ist bei
 * Spätentwicklern zu früh und weit vor der Pubertät sehr unsicher.
 */
export type TimingAssessment = {
  timing: GrowthMaturity;
  source: "manual" | "observed" | "presumed";
  phvAge: number | null;
};

type AnalysisTrajectories = Partial<Record<TrajectoryModel, GrowthTrajectories>>;

export type GrowthAnalysis = {
  points: GrowthPoint[];
  latest: GrowthPoint | null;
  predictions: Prediction[];
  maturity: MaturityOffset | null;
  /** Aktuelle Größe in % der Khamis-Roche-Zielgröße. */
  percentOfTarget: number | null;
  /** Wachstumsrate zwischen den letzten beiden Messungen (cm/Jahr). */
  growthVelocity: number | null;
  velocity: VelocityPoint[];
  peak: PeakResult;
  timing: TimingAssessment | null;
  /**
   * Woraus Geschwindigkeit und Gipfel stammen. reach: zu wenige Größenmessungen,
   * stattdessen aus der Reichhöhe der Leistungstests (auf Größen-cm umgerechnet).
   */
  velocitySource:
    { kind: "height" } | { kind: "reach"; scale: number; scaleSource: "measured" | "default" };
  /** Moore-Schätzung für das Alter beim Wachstumsschub, nur als Zahl und ohne Einstufung. */
  phvEstimate: { age: number; equation: string } | null;
  /** Modell, das die Kaskade als verlässlichste Zielgröße auswählt. */
  primaryPredictionId: PredictionModelId | null;
  /** Verlauf je Entwicklungstyp zur Zielgröße von Khamis-Roche bzw. Elterngröße. */
  modelTrajectories: Partial<Record<TrajectoryModel, GrowthTrajectories>>;
  /** Kurzer Grund je Modell mit Zielgröße, aber ohne Verlauf. */
  curveNotes: Partial<Record<PredictionModelId, string>>;
  /** Verlauf zur Mirwald/Sherar-Zielgröße mit Band. */
  mirwaldCurve: MirwaldCurve | null;
};

/**
 * Reihenfolge der Zielgrößen-Modelle von der verlässlichsten zur gröbsten
 * Quelle: Khamis-Roche (Alter ab 4, Größe, Gewicht, beide Eltern), dann die
 * Elterngröße nach Tanner (auch ohne Gewicht oder unter 4 Jahren), dann
 * Mirwald/Sherar (ohne Elterndaten). Die erste berechenbare Quelle gewinnt.
 */
const PRIMARY_PREDICTION_ORDER: PredictionModelId[] = [
  "khamis-roche",
  "mid-parent",
  "mirwald-sherar",
];

export function selectPrimaryPrediction(predictions: Prediction[]): PredictionModelId | null {
  for (const id of PRIMARY_PREDICTION_ORDER) {
    if (predictions.some((prediction) => prediction.id === id && prediction.value !== null)) {
      return id;
    }
  }

  return null;
}

/**
 * Ab diesem Alter zeigen die Typ-Verläufe etwas: Davor liegt der Schub so weit
 * weg, dass sich die Typen kaum unterscheiden. Ein beobachteter Gipfel oder ein
 * bekannter Typ hebt die Grenze auf.
 */
export const TRAJECTORY_MIN_AGE: Record<GrowthSex, number> = { female: 9, male: 10 };

/** Zielgrößen-Modelle, deren Verlauf aus den Typ-Kurven entsteht (Mirwald/Sherar hat eine eigene Kurve). */
export type TrajectoryModel = "khamis-roche" | "mid-parent";

/** Moore gilt nur rund um die Pubertät sinnvoll. */
const ESTIMATE_MIN_AGE = 9;
const ESTIMATE_MAX_AGE = 17;

/**
 * Der Gipfel liegt nach der Spät-Grenze, wenn der Spieler schon älter ist und
 * trotz dichter Messungen noch kein Schub zu sehen ist (oder der höchste Wert
 * gerade erst nach der Grenze auftritt). Das ist ein Indiz, kein Beweis: Ein
 * flacher Schub kann im Messrauschen untergehen.
 */
function isLateByAbsence(sex: GrowthSex, latestAge: number, peak: PeakResult): boolean {
  const lateThreshold = PHV_TIMING_THRESHOLDS[sex].late;

  if (peak.reason === "no-spurt") {
    return latestAge > lateThreshold;
  }

  return peak.reason === "rising" && peak.highestAge !== null && peak.highestAge > lateThreshold;
}

export function buildGrowthAnalysis(
  profile: GrowthProfile,
  measurements: GrowthMeasurement[],
  reachTests: ReachTest[] = [],
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

  // Khamis-Roche braucht das Gewicht. Fehlt es bei der letzten Messung, zählt
  // die jüngste Messung mit Gewicht; ihre Prognose gilt für die Endgröße und
  // bleibt daher auch für die aktuelle Größe aussagekräftig.
  const krBasis = [...points].reverse().find((point) => point.khamisRoche !== null) ?? null;

  const krMissing: string[] = [];
  if (!hasParents) krMissing.push("Größe beider Eltern");
  if (!krBasis) {
    const weighted = points.filter((point) => point.weight_kg !== null);
    if (points.length === 0) {
      krMissing.push("Messung");
    } else if (weighted.length === 0) {
      krMissing.push("Messung mit Gewicht");
    } else if (hasParents) {
      krMissing.push(
        `Messung mit Gewicht im Alter zwischen ${KHAMIS_ROCHE_MIN_AGE} und ${KHAMIS_ROCHE_MAX_AGE} Jahren`,
      );
    }
  }

  const predictions: Prediction[] = [
    {
      id: "khamis-roche",
      label: "Khamis-Roche",
      description: null,
      value: krBasis?.khamisRoche ?? null,
      range: KHAMIS_ROCHE_ERROR_90_CM[sex],
      basisDate: krBasis?.measured_at ?? null,
      basisLabel: null,
      missing: krBasis ? [] : krMissing,
    },
    {
      id: "mid-parent",
      label: "Elterngröße (Tanner)",
      description: null,
      value: hasParents ? midParentTargetHeight(sex, mother_height_cm, father_height_cm) : null,
      range: MID_PARENT_RANGE_CM,
      basisDate: null,
      basisLabel: null,
      missing: hasParents ? [] : ["Größe beider Eltern"],
    },
  ];

  // Khamis-Roche mit Entwicklungsalter: Alter minus manuell gesetzte Verzögerung. Das ist
  // keine validierte Anwendung der Methode (sie rechnet mit dem Kalenderalter von
  // durchschnittlich entwickelten Kindern), sondern eine Näherung für früh/spät Entwickelnde.
  const delay = profile.maturity_delay_years;

  if (delay !== null && delay !== 0) {
    const adjustedAge = krBasis ? krBasis.age - delay : null;
    const adjusted =
      krBasis && hasParents && krBasis.weight_kg !== null && adjustedAge !== null
        ? predictKhamisRoche({
            sex,
            age: adjustedAge,
            heightCm: krBasis.height_cm,
            weightKg: krBasis.weight_kg,
            motherHeightCm: mother_height_cm,
            fatherHeightCm: father_height_cm,
          })
        : null;
    const formatAge = (age: number) => age.toFixed(1).replace(".", ",");

    predictions.splice(1, 0, {
      id: "khamis-roche-adjusted",
      label: "Khamis-Roche (Entwicklungsalter)",
      description:
        krBasis && adjustedAge !== null
          ? `Alter ${formatAge(adjustedAge)} statt ${formatAge(krBasis.age)} J., nicht validiert`
          : null,
      value: adjusted,
      range: null,
      basisDate: krBasis?.measured_at ?? null,
      basisLabel: null,
      missing:
        adjusted !== null
          ? []
          : krBasis
            ? ["Entwicklungsalter zwischen 4 und 17,5 Jahren"]
            : krMissing,
    });
  }

  // Mit gesetzter Entwicklungsverzögerung zählt die Zielgröße mit Entwicklungsalter.
  const adjustedTarget = predictions.find((p) => p.id === "khamis-roche-adjusted")?.value ?? null;
  const percentTarget = adjustedTarget ?? krBasis?.khamisRoche ?? null;
  const percentOfTarget = latest && percentTarget ? (latest.height_cm / percentTarget) * 100 : null;

  const maturity = latest
    ? mooreMaturityOffset({
        sex,
        age: latest.age,
        heightCm: latest.height_cm,
        sittingHeightCm: latest.sitting_height_cm,
      })
    : null;

  let velocity = buildVelocitySeries(points);
  let peak = detectPeak(velocity);
  let velocitySource: GrowthAnalysis["velocitySource"] = { kind: "height" };
  let latestAge = latest?.age ?? null;

  // Zu wenige Größenmessungen: Gipfel aus der Reichhöhe der Leistungstests.
  if (peak.status === "insufficient" && reachTests.length > 0) {
    const reach = buildReachSamples(reachTests, birth_date, points);
    const reachVelocity = buildVelocitySeries(reach.samples);
    const reachPeak = detectPeak(reachVelocity);

    if (reachPeak.status !== "insufficient") {
      velocity = reachVelocity;
      peak = reachPeak;
      velocitySource = { kind: "reach", scale: reach.scale, scaleSource: reach.scaleSource };
      latestAge = Math.max(latestAge ?? 0, reach.samples.at(-1)?.age ?? 0);
    }
  }

  const growthVelocity = velocity.at(-1)?.velocity ?? null;

  let timing: TimingAssessment | null = null;
  if (profile.maturity_override) {
    timing = { timing: profile.maturity_override, source: "manual", phvAge: peak.age };
  } else if (peak.status === "confirmed" && peak.age !== null) {
    timing = { timing: classifyPhvTiming(sex, peak.age), source: "observed", phvAge: peak.age };
  } else if (latestAge !== null && isLateByAbsence(sex, latestAge, peak)) {
    timing = { timing: "late", source: "presumed", phvAge: null };
  }

  // Mirwald/Sherar: Sherars Restwachstum hängt am Abstand zum Schub und am Entwicklungstyp.
  // Beides stammt, wenn bekannt, aus den Messungen bzw. der Einstufung; die Mirwald-Gleichung
  // ist nur der Rückfall, weil sie bei früh/spät Entwickelnden stark danebenliegt.
  const msBasis = latest;
  const formatYears = (years: number) => years.toFixed(1).replace(".", ",").replace("-", "−");
  const spurtAhead =
    peak.status === "pending" && peak.reason !== "no-rise" && peak.reason !== "no-drop";
  let ms: MirwaldSherarResult | null = null;
  let msBasisText: string | null = null;
  let msBasisLabel: string | null = null;
  let msBasisDate: string | null = msBasis?.measured_at ?? null;
  // Alter der Messung, auf der Offset und Prognose beruhen (bei der Schätzung evtl. älter als die letzte).
  let msBasisAge: number | null = msBasis?.age ?? null;

  if (msBasis) {
    const base = { sex, age: msBasis.age, heightCm: msBasis.height_cm };
    const manual = profile.maturity_override;

    if (peak.status === "confirmed" && peak.age !== null) {
      ms = predictFromOffset({
        ...base,
        offsetYears: msBasis.age - peak.age,
        group: manual ?? sherarMaturityGroup(sex, peak.age),
        source: "observed",
      });
      msBasisText = `Schub bei ${formatYears(peak.age)} J. beobachtet, ${timingLabels[ms.group]}`;
      msBasisLabel = "Schub beobachtet";
    } else if (manual || timing?.source === "presumed") {
      const group = manual ?? timing?.timing ?? "late";
      // Ohne bestätigten Gipfel liegt der Schub noch vor dem Kind oder läuft gerade.
      const offsetYears = Math.min(msBasis.age - SHERAR_GROUP_PHV_AGE[sex][group], 0);
      ms = predictFromOffset({ ...base, offsetYears, group, source: "group" });
      msBasisText = `Schub noch nicht beobachtet, Typ ${timingLabels[group]}`;
      msBasisLabel = manual ? "Typ festgelegt" : "Typ angenommen";
    } else {
      // Rückfall: Mirwald braucht Sitzhöhe und Gewicht, es zählt die jüngste Messung mit beidem.
      const full = [...points]
        .reverse()
        .find((point) => point.sitting_height_cm !== null && point.weight_kg !== null);

      if (full && full.sitting_height_cm !== null && full.weight_kg !== null) {
        const fullBase = { sex, age: full.age, heightCm: full.height_cm };
        const estimate = predictMirwaldSherar({
          ...fullBase,
          sittingHeightCm: full.sitting_height_cm,
          weightKg: full.weight_kg,
        });
        // Zeigen die Messungen noch keinen Schub, kann er nicht schon vorbei sein.
        ms = spurtAhead
          ? predictFromOffset({
              ...fullBase,
              offsetYears: Math.min(estimate.offsetYears, 0),
              group: estimate.group,
              source: "estimate",
            })
          : estimate;
        msBasisText = `Schub geschätzt ${ms.offsetYears > 0 ? "+" : ""}${formatYears(ms.offsetYears)} J., ${timingLabels[ms.group]}`;
        msBasisLabel = "Schub geschätzt";
        msBasisDate = full.measured_at;
        msBasisAge = full.age;
      }
    }
  }

  const msMissing = !msBasis
    ? ["Messung"]
    : ms === null
      ? ["Messung mit Sitzhöhe und Gewicht"]
      : ms.predictedHeightCm === null
        ? ["Messung höchstens 4 Jahre vor oder nach dem Wachstumsschub"]
        : [];

  predictions.push({
    id: "mirwald-sherar",
    label: "Mirwald/Sherar",
    description: ms ? msBasisText : null,
    basisLabel: ms ? msBasisLabel : null,
    value: ms?.predictedHeightCm ?? null,
    // Der Fehlerbereich gilt nur, wenn der Abstand zum Schub aus den Messungen stammt.
    range: ms?.source === "observed" ? SHERAR_ERROR_95_CM[sex] : null,
    basisDate: ms ? msBasisDate : null,
    missing: msMissing,
  });

  const phvEstimate =
    maturity && latest && latest.age >= ESTIMATE_MIN_AGE && latest.age <= ESTIMATE_MAX_AGE
      ? { age: maturity.ageAtPhv, equation: maturity.equation }
      : null;

  const primaryPredictionId = selectPrimaryPrediction(predictions);
  // Zeigen die Messungen keinen Schub, darf er rechnerisch nicht schon vorbei sein.
  const spurtUnconfirmed =
    peak.status !== "confirmed" &&
    (spurtAhead || timing?.source === "presumed" || profile.maturity_override !== null);
  const knownGroup = ms && ms.source !== "estimate" ? ms.group : null;

  // Je Zielgrößen-Kachel ein Verlauf zu ihrer eigenen Zielgröße. Bei Khamis-Roche zählt, wie bei
  // "% erreicht", die Zielgröße mit Entwicklungsalter, falls gesetzt.
  const trajectoryTargets: Record<TrajectoryModel, number | null> = {
    "khamis-roche":
      adjustedTarget ?? predictions.find((p) => p.id === "khamis-roche")?.value ?? null,
    "mid-parent": predictions.find((p) => p.id === "mid-parent")?.value ?? null,
  };
  const modelTrajectories: AnalysisTrajectories = {};
  const curveNotes: GrowthAnalysis["curveNotes"] = {};
  const tooYoung =
    latest !== null &&
    peak.status !== "confirmed" &&
    knownGroup === null &&
    latest.age < TRAJECTORY_MIN_AGE[sex];

  for (const model of Object.keys(trajectoryTargets) as TrajectoryModel[]) {
    const target = trajectoryTargets[model];

    if (!latest || target === null) continue;

    if (tooYoung) {
      curveNotes[model] = `Verlauf erst ab ${TRAJECTORY_MIN_AGE[sex]} Jahren`;
      continue;
    }

    if (target <= latest.height_cm) {
      curveNotes[model] = "Zielgröße nicht über der aktuellen Größe";
      continue;
    }

    const trajectories = buildTypeTrajectories({
      sex,
      age: latest.age,
      heightCm: latest.height_cm,
      targetCm: target,
      maxOffsetYears: spurtUnconfirmed ? 0 : null,
      knownGroup,
      knownOffsetYears: knownGroup && ms ? ms.offsetYears : null,
    });

    if (trajectories) {
      modelTrajectories[model] = trajectories;
    } else {
      curveNotes[model] = "Kein Verlauf berechenbar";
    }
  }

  const mirwaldCurve =
    latest && ms && ms.predictedHeightCm !== null && msBasisAge !== null
      ? buildMirwaldCurve({
          sex,
          age: latest.age,
          heightCm: latest.height_cm,
          targetCm: ms.predictedHeightCm,
          group: ms.group,
          offsetYears: ms.offsetYears + (latest.age - msBasisAge),
          source: ms.source,
          errorCm: SHERAR_ERROR_95_CM[sex],
          maxOffsetYears: spurtUnconfirmed ? 0 : null,
        })
      : null;

  if (ms?.predictedHeightCm != null && !mirwaldCurve) {
    curveNotes["mirwald-sherar"] = "Wachstum laut Sherar-Tabelle abgeschlossen";
  }

  return {
    points,
    latest,
    predictions,
    maturity,
    percentOfTarget,
    growthVelocity,
    velocity,
    peak,
    timing,
    velocitySource,
    phvEstimate,
    primaryPredictionId,
    modelTrajectories,
    curveNotes,
    mirwaldCurve,
  };
}
