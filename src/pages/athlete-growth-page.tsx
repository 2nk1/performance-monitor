import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CurveToggle } from "@/components/curve-toggle";
import { GrowthChart } from "@/components/growth-chart";
import { GrowthJumpChart } from "@/components/growth-jump-chart";
import { GrowthVelocityChart } from "@/components/growth-velocity-chart";
import {
  fetchGrowthMeasurementsByParticipant,
  fetchGrowthProfile,
  fetchParticipantById,
  fetchPerformanceTestsByParticipant,
  queryKeys,
} from "@/lib/data";
import { formatTestDate } from "@/lib/format";
import { ageInYears, buildGrowthAnalysis, type GrowthAnalysis } from "@/lib/growth/analysis";
import { formatPercentile, heightPercentile } from "@/lib/growth/percentiles";
import { predictionColors } from "@/lib/growth/colors";
import {
  CURVES_PARAM,
  parseVisibleCurves,
  serializeVisibleCurves,
  withCurve,
  type CurveKey,
} from "@/lib/growth/curve-visibility";
import { buildJumpSeries } from "@/lib/growth/jump";
import { armSpanRatio } from "@/lib/growth/proportions";
import { PHV_TIMING_THRESHOLDS, timingLabels } from "@/lib/growth/timing";
import type { GrowthSex } from "@/lib/types";
import { NotFoundPage } from "@/pages/not-found-page";

const formatNumber = (value: number, decimals = 1) =>
  value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Eine kurze Zeile unter dem Entwicklungstyp. */
function timingSummary(timing: GrowthAnalysis["timing"], analysis: GrowthAnalysis): string {
  if (!timing) {
    return analysis.phvEstimate
      ? `Schub laut Moore ca. ${formatNumber(analysis.phvEstimate.age)} J.`
      : "Noch kein Schub in Sicht";
  }

  switch (timing.source) {
    case "manual":
      return "Festgelegt";
    case "observed":
      return `Gipfel bei ${formatNumber(timing.phvAge ?? 0)} J.`;
    case "presumed":
      return "Angenommen";
  }
}

/** Ausführlichere Erklärung, nur als Tooltip. */
function timingTooltip(timing: GrowthAnalysis["timing"], sex: GrowthSex): string {
  if (!timing) {
    return "Keine Einstufung ohne beobachteten Gipfel. Die Moore-Schätzung ist vor der Pubertät unsicher (±0,5 Jahre) und bei Spätentwicklern zu früh.";
  }

  switch (timing.source) {
    case "manual":
      return "Im Profil festgelegt, überschreibt die Automatik.";
    case "observed":
      return "Aus dem beobachteten Gipfel der Wachstumsrate.";
    case "presumed":
      return `Älter als die Spät-Grenze (${formatNumber(PHV_TIMING_THRESHOLDS[sex].late)} J.) und noch kein Schub sichtbar. Ein sehr flacher Schub könnte im Messrauschen untergehen.`;
  }
}

type PredictionTileProps = {
  prediction: GrowthAnalysis["predictions"][number];
  analysis: GrowthAnalysis;
  /** Khamis-Roche mit Entwicklungsalter, nur an der Khamis-Roche-Kachel. */
  adjusted: GrowthAnalysis["predictions"][number] | null;
  isPrimary: boolean;
  checked: boolean;
  onToggle: (on: boolean) => void;
};

/** Eine Zielgrößen-Kachel: Wert, Bereich, eine Statuszeile; Details stehen im Tooltip. */
function PredictionTile({
  prediction,
  analysis,
  adjusted,
  isPrimary,
  checked,
  onToggle,
}: PredictionTileProps) {
  const color = predictionColors[prediction.id];
  const isKhamisRoche = prediction.id === "khamis-roche";
  const stale =
    prediction.basisDate && prediction.basisDate !== analysis.latest?.measured_at
      ? prediction.basisDate
      : null;

  return (
    <div
      className="flex flex-col rounded-xl border border-card-border bg-card p-5"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm text-foreground/60">{prediction.label}</p>
          {isPrimary ? (
            <span
              className="rounded-full border border-card-border px-2 py-0.5 text-[11px] text-foreground/70"
              title="Verlässlichste berechenbare Quelle (Khamis-Roche vor Elterngröße vor Mirwald/Sherar). Die Typ-Verläufe enden bei dieser Zielgröße."
            >
              Hauptquelle
            </span>
          ) : null}
        </div>
        {prediction.value !== null ? (
          <CurveToggle
            checked={checked}
            onChange={onToggle}
            description={`Zielgröße ${prediction.label} im Diagramm anzeigen`}
            color={color}
          />
        ) : null}
      </div>

      {prediction.value !== null ? (
        <>
          <p className="mt-2 text-3xl font-semibold">
            {formatNumber(prediction.value)} <span className="text-lg">cm</span>
          </p>
          {prediction.range ? (
            <p className="mt-1 text-sm text-foreground/60">
              {formatNumber(prediction.value - prediction.range)} –{" "}
              {formatNumber(prediction.value + prediction.range)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-foreground/60">Es fehlt: {prediction.missing.join(", ")}</p>
      )}

      {prediction.basisLabel && prediction.value !== null ? (
        <p className="mt-1 text-sm text-foreground/60" title={prediction.description ?? undefined}>
          {prediction.basisLabel}
          {prediction.range === null ? " · kein Fehlerbereich" : ""}
        </p>
      ) : null}

      {isKhamisRoche && analysis.percentOfTarget !== null ? (
        <p
          className="mt-1 text-sm text-foreground/60"
          title={
            adjusted?.value != null
              ? "Aktuelle Größe in % der Zielgröße mit Entwicklungsalter"
              : "Aktuelle Größe in % der Zielgröße"
          }
        >
          {formatNumber(analysis.percentOfTarget)} % erreicht
        </p>
      ) : null}

      {adjusted ? (
        <p className="mt-1 text-sm text-foreground/60" title={adjusted.description ?? undefined}>
          {adjusted.value !== null ? (
            <>
              mit Entw.-Alter{" "}
              <span style={{ color: predictionColors["khamis-roche-adjusted"] }}>
                {formatNumber(adjusted.value)} cm
              </span>
            </>
          ) : (
            `mit Entw.-Alter: es fehlt ${adjusted.missing.join(", ")}`
          )}
        </p>
      ) : null}

      {stale && prediction.value !== null ? (
        <p
          className="mt-auto pt-3 text-xs text-foreground/50"
          title={`Letzte Messung mit ${
            prediction.id === "mirwald-sherar" ? "Sitzhöhe und Gewicht" : "Gewicht"
          }`}
        >
          Stand {formatTestDate(stale)}
        </p>
      ) : null}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function AthleteGrowthPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const participantQuery = useQuery({
    queryKey: queryKeys.participant(id ?? ""),
    queryFn: () => fetchParticipantById(id ?? ""),
    enabled: !!id,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.growthProfile(id ?? ""),
    queryFn: () => fetchGrowthProfile(id ?? ""),
    enabled: !!id,
  });

  const measurementsQuery = useQuery({
    queryKey: queryKeys.growthMeasurementsByParticipant(id ?? ""),
    queryFn: () => fetchGrowthMeasurementsByParticipant(id ?? ""),
    enabled: !!id,
  });

  const testsQuery = useQuery({
    queryKey: queryKeys.performanceTestsByParticipant(id ?? ""),
    queryFn: () => fetchPerformanceTestsByParticipant(id ?? ""),
    enabled: !!id,
  });

  const analysis = useMemo(
    () =>
      profileQuery.data
        ? buildGrowthAnalysis(
            profileQuery.data,
            measurementsQuery.data ?? [],
            testsQuery.data ?? [],
          )
        : null,
    [profileQuery.data, measurementsQuery.data, testsQuery.data],
  );

  const jumpPoints = useMemo(
    () =>
      profileQuery.data && testsQuery.data
        ? buildJumpSeries(testsQuery.data, profileQuery.data.birth_date)
        : [],
    [profileQuery.data, testsQuery.data],
  );

  if (
    participantQuery.isPending ||
    profileQuery.isPending ||
    measurementsQuery.isPending ||
    testsQuery.isPending
  ) {
    return <p className="text-sm text-foreground/60">Lade Wachstumsdaten...</p>;
  }

  if (!id) {
    return <NotFoundPage />;
  }

  const error = participantQuery.error ?? profileQuery.error ?? measurementsQuery.error;
  if (error) {
    return <p className="text-sm text-red-400">{error.message}</p>;
  }

  const participant = participantQuery.data;
  if (!participant) {
    return <NotFoundPage />;
  }

  const profile = profileQuery.data;
  const adjustedPrediction =
    analysis?.predictions.find((prediction) => prediction.id === "khamis-roche-adjusted") ?? null;
  const currentPercentile =
    profile && analysis?.latest
      ? heightPercentile(profile.sex, analysis.latest.age, analysis.latest.height_cm)
      : null;
  const measurementsDesc = analysis ? [...analysis.points].reverse() : [];

  // Welche Kurven im Diagramm stehen, liegt in der URL: per Link teilbar, mit Zurück-Taste
  // erreichbar. Ohne Parameter gilt der Standard (Hauptprognose und Typ-Verläufe).
  const primaryId = analysis?.primaryPredictionId ?? null;
  const visibleCurves = parseVisibleCurves(searchParams.get(CURVES_PARAM), primaryId);
  const toggleCurve = (key: CurveKey, on: boolean) => {
    const value = serializeVisibleCurves(withCurve(visibleCurves, key, on), primaryId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === null) {
          next.delete(CURVES_PARAM);
        } else {
          next.set(CURVES_PARAM, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  return (
    <>
      <header className="mb-8">
        <Link
          to={`/athletes/${participant.id}`}
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          {`<- ${participant.name}`}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Wachstum</h1>
            <p className="mt-2 text-sm text-foreground/60">
              {participant.name}
              {profile
                ? ` · ${profile.sex === "male" ? "männlich" : "weiblich"} · geb. ${formatTestDate(profile.birth_date)} · ${formatNumber(ageInYears(profile.birth_date, today()))} Jahre`
                : ""}
              {profile?.mother_height_cm && profile.father_height_cm
                ? ` · Eltern ${formatNumber(profile.mother_height_cm)} / ${formatNumber(profile.father_height_cm)} cm`
                : ""}
              {currentPercentile !== null
                ? ` · Größe P${formatPercentile(currentPercentile)} (KiGGS)`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {profile ? (
              <Link
                to={`/compare/growth?ids=${participant.id}`}
                className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-sage/20"
              >
                Mit anderen vergleichen
              </Link>
            ) : null}
            <Link
              to={`/athletes/${participant.id}/growth/profile`}
              className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-sage/20"
            >
              {profile ? "Profil bearbeiten" : "Profil anlegen"}
            </Link>
            {profile ? (
              <Link
                to={`/athletes/${participant.id}/growth/measurements/new`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Messung hinzufügen
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {!profile || !analysis ? (
        <div className="max-w-xl rounded-xl border border-card-border bg-card p-6 text-sm">
          <p className="font-medium">Noch kein Wachstumsprofil vorhanden.</p>
          <p className="mt-2 text-foreground/60">
            Für die Prognosen werden Geschlecht, genaues Geburtsdatum und idealerweise die Größe
            beider Eltern benötigt.
          </p>
          <Link
            to={`/athletes/${participant.id}/growth/profile`}
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
          >
            Profil anlegen
          </Link>
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-medium text-foreground/60">Zielgröße</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {analysis.predictions
                .filter((prediction) => prediction.id !== "khamis-roche-adjusted")
                .map((prediction) => (
                  <PredictionTile
                    key={prediction.id}
                    prediction={prediction}
                    analysis={analysis}
                    adjusted={prediction.id === "khamis-roche" ? adjustedPrediction : null}
                    isPrimary={prediction.id === analysis.primaryPredictionId}
                    checked={visibleCurves.has(prediction.id as CurveKey)}
                    onToggle={(on) => toggleCurve(prediction.id as CurveKey, on)}
                  />
                ))}

              <div
                className="rounded-xl border border-card-border bg-card p-5"
                title={timingTooltip(analysis.timing, profile.sex)}
              >
                <p className="text-sm text-foreground/60">Entwicklungstyp</p>
                <p className="mt-2 text-xl font-semibold break-words">
                  {analysis.timing ? timingLabels[analysis.timing.timing] : "Noch nicht einstufbar"}
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  {timingSummary(analysis.timing, analysis)}
                </p>
                {analysis.growthVelocity !== null ? (
                  <p className="mt-1 text-sm text-foreground/60">
                    {formatNumber(analysis.growthVelocity)} cm/Jahr
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Wachstumskurve</h2>
            <GrowthChart
              points={analysis.points}
              predictions={analysis.predictions}
              modelTrajectories={analysis.modelTrajectories}
              mirwaldCurve={analysis.mirwaldCurve}
              curveNotes={analysis.curveNotes}
              sex={profile.sex}
              visible={visibleCurves}
            />
            <p className="mt-3 text-xs text-foreground/50">
              Gestrichelt: Zielgröße der aktiven Kachel, schattiert ihr Fehlerbereich
              (Mirwald/Sherar nur bei beobachtetem Schub). Dünne Linien: möglicher Verlauf dorthin
              nach Sherar et al. (2005), ab der letzten Messung. Das Band darum zeigt, wie sich der
              Verlauf je nach Entwicklungstyp unterscheidet, und nicht, wie sicher die Zielgröße
              ist.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">
              Wachstumsgeschwindigkeit
              {analysis.velocitySource.kind === "reach" ? (
                <span className="ml-2 text-sm font-normal text-foreground/60">aus Reichhöhe</span>
              ) : null}
            </h2>
            <GrowthVelocityChart
              velocity={analysis.velocity}
              sex={profile.sex}
              peak={analysis.peak}
            />
            <p className="mt-3 text-xs text-foreground/50">
              {analysis.peak.status === "confirmed" ? "" : `${analysis.peak.note} `}
              {analysis.velocitySource.kind === "reach"
                ? `Zu wenige Größenmessungen, Rate aus der Reichhöhe der Leistungstests × ${formatNumber(analysis.velocitySource.scale, 2)} (${analysis.velocitySource.scaleSource === "measured" ? "Größe/Reichhöhe gemessen" : "Erfahrungswert"}). `
                : ""}
              Bänder: Gipfelalter früh, normal, spät (Kozieł & Malina 2018). Gepunktet: Median der
              KiGGS-Referenz, glättet den Schub.
            </p>
          </section>

          {jumpPoints.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Sprunghöhe und Wachstumsschub</h2>
              <GrowthJumpChart
                points={jumpPoints}
                peakAge={analysis.peak.age}
                estimatedPeakAge={
                  // Moore liegt bei Spätentwicklern systematisch zu früh, dann lieber keine Markierung.
                  analysis.timing?.timing === "late" ? null : (analysis.phvEstimate?.age ?? null)
                }
              />
              <p className="mt-3 text-xs text-foreground/50">
                Sprunghöhe aus den Leistungstests (Sprungreichhöhe minus Reichhöhe). Rund um den
                Wachstumsgipfel stagniert die Sprungleistung oft, danach legt sie zu.
              </p>
            </section>
          ) : null}

          <section>
            <h2 className="mb-4 text-lg font-semibold">Messungen</h2>

            <div className="overflow-x-auto rounded-xl border border-card-border bg-card">
              <div className="grid min-w-[960px] grid-cols-[100px_70px_repeat(7,1fr)_70px] gap-4 border-b border-card-border px-5 py-3 text-sm font-medium text-foreground/60">
                <span>Datum</span>
                <span>Alter</span>
                <span>Größe</span>
                <span>Gewicht</span>
                <span>Sitzhöhe</span>
                <span>Armspanne</span>
                <span>Spanne/Größe</span>
                <span>Prognose KR</span>
                <span>% Endgröße</span>
                <span></span>
              </div>

              {measurementsDesc.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-foreground/60">
                  Noch keine Messungen vorhanden.
                </div>
              ) : (
                measurementsDesc.map((point) => (
                  <div
                    key={point.id}
                    className="grid min-w-[960px] grid-cols-[100px_70px_repeat(7,1fr)_70px] gap-4 border-b border-card-border/50 px-5 py-4 text-sm last:border-b-0"
                  >
                    <span>{formatTestDate(point.measured_at)}</span>
                    <span>{formatNumber(point.age)}</span>
                    <span>{formatNumber(point.height_cm)} cm</span>
                    <span>
                      {point.weight_kg !== null ? `${formatNumber(point.weight_kg)} kg` : "-"}
                    </span>
                    <span>
                      {point.sitting_height_cm !== null
                        ? `${formatNumber(point.sitting_height_cm)} cm`
                        : "-"}
                    </span>
                    <span>
                      {point.arm_span_cm !== null ? `${formatNumber(point.arm_span_cm)} cm` : "-"}
                    </span>
                    <span>
                      {armSpanRatio(point.arm_span_cm, point.height_cm) !== null
                        ? formatNumber(armSpanRatio(point.arm_span_cm, point.height_cm) ?? 0, 2)
                        : "-"}
                    </span>
                    <span>
                      {point.khamisRoche !== null ? `${formatNumber(point.khamisRoche)} cm` : "-"}
                    </span>
                    <span>
                      {point.percentPredicted !== null
                        ? `${formatNumber(point.percentPredicted)} %`
                        : "-"}
                    </span>
                    <Link
                      to={`/athletes/${participant.id}/growth/measurements/${point.id}/edit`}
                      className="text-sm font-medium text-foreground/70 hover:text-foreground"
                    >
                      Ändern
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
