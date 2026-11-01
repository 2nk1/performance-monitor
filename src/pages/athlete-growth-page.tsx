import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { GrowthChart } from "@/components/growth-chart";
import { GrowthVelocityChart } from "@/components/growth-velocity-chart";
import {
  fetchGrowthMeasurementsByParticipant,
  fetchGrowthProfile,
  fetchParticipantById,
  queryKeys,
} from "@/lib/data";
import { formatTestDate } from "@/lib/format";
import { ageInYears, buildGrowthAnalysis, type GrowthAnalysis } from "@/lib/growth/analysis";
import { formatPercentile, heightPercentile } from "@/lib/growth/percentiles";
import { predictionColors } from "@/lib/growth/colors";
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
function timingSummary(
  timing: GrowthAnalysis["timing"],
  analysis: GrowthAnalysis,
  velocity: string,
): string {
  if (!timing) {
    return analysis.phvEstimate
      ? `Schub laut Moore ca. ${formatNumber(analysis.phvEstimate.age)} J.${velocity}`
      : `Noch kein Schub in Sicht${velocity}`;
  }

  switch (timing.source) {
    case "manual":
      return `Manuell festgelegt${velocity}`;
    case "observed":
      return `Gipfel bei ${formatNumber(timing.phvAge ?? 0)} J.${velocity}`;
    case "presumed":
      return `Kein Gipfel bis ${formatNumber(analysis.latest?.age ?? 0)} J.${velocity}`;
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

const today = () => new Date().toISOString().slice(0, 10);

export function AthleteGrowthPage() {
  const { id } = useParams<{ id: string }>();

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

  const analysis = useMemo(
    () =>
      profileQuery.data
        ? buildGrowthAnalysis(profileQuery.data, measurementsQuery.data ?? [])
        : null,
    [profileQuery.data, measurementsQuery.data],
  );

  if (participantQuery.isPending || profileQuery.isPending || measurementsQuery.isPending) {
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

          <div className="flex gap-3">
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
          <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {analysis.predictions
              .filter((prediction) => prediction.id !== "khamis-roche-adjusted")
              .map((prediction) => (
                <div
                  key={prediction.id}
                  className="rounded-xl border border-card-border bg-card p-5"
                  style={{ borderTop: `3px solid ${predictionColors[prediction.id]}` }}
                >
                  <p className="text-sm text-foreground/60">Zielgröße · {prediction.label}</p>
                  {prediction.value !== null ? (
                    <>
                      <p className="mt-2 text-3xl font-semibold">
                        {formatNumber(prediction.value)} <span className="text-lg">cm</span>
                      </p>
                      {prediction.range ? (
                        <p className="mt-1 text-sm text-foreground/60">
                          {formatNumber(prediction.value - prediction.range)} –{" "}
                          {formatNumber(prediction.value + prediction.range)} cm
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-foreground/60">
                      Nicht berechenbar. Es fehlt: {prediction.missing.join(", ")}
                    </p>
                  )}
                  {prediction.id === "khamis-roche" && adjustedPrediction ? (
                    <div
                      className="mt-3 border-t border-card-border pt-3"
                      title={adjustedPrediction.description ?? undefined}
                    >
                      <p className="text-xs text-foreground/60">mit Entwicklungsalter</p>
                      {adjustedPrediction.value !== null ? (
                        <p
                          className="mt-1 text-xl font-semibold"
                          style={{ color: predictionColors["khamis-roche-adjusted"] }}
                        >
                          {formatNumber(adjustedPrediction.value)}{" "}
                          <span className="text-sm">cm</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-foreground/60">
                          Nicht berechenbar. Es fehlt: {adjustedPrediction.missing.join(", ")}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {(() => {
                    const footer =
                      prediction.basisDate && prediction.basisDate !== analysis.latest?.measured_at
                        ? `Stand ${formatTestDate(prediction.basisDate)} (letzte Messung mit Gewicht)`
                        : prediction.description;

                    return footer ? (
                      <p className="mt-3 text-xs text-foreground/50">{footer}</p>
                    ) : null;
                  })()}
                </div>
              ))}

            <div
              className="rounded-xl border border-card-border bg-card p-5"
              title={
                analysis.predictions.some(
                  (p) => p.id === "khamis-roche-adjusted" && p.value !== null,
                )
                  ? "Aktuelle Größe in % der Khamis-Roche-Zielgröße mit Entwicklungsalter"
                  : "Aktuelle Größe in % der Khamis-Roche-Zielgröße"
              }
            >
              <p className="text-sm text-foreground/60">Erreichte Zielgröße</p>
              {analysis.percentOfTarget !== null ? (
                <p className="mt-2 text-3xl font-semibold">
                  {formatNumber(analysis.percentOfTarget)} %
                </p>
              ) : (
                <p className="mt-2 text-sm text-foreground/60">Braucht Khamis-Roche</p>
              )}
            </div>

            <div
              className="rounded-xl border border-card-border bg-card p-5"
              title={timingTooltip(analysis.timing, profile.sex)}
            >
              <p className="text-sm text-foreground/60">Entwicklungstyp</p>
              <p className="mt-2 text-xl font-semibold break-words">
                {analysis.timing ? timingLabels[analysis.timing.timing] : "Noch nicht einstufbar"}
              </p>
              <p className="mt-1 text-sm text-foreground/60">
                {timingSummary(
                  analysis.timing,
                  analysis,
                  analysis.growthVelocity !== null
                    ? ` · ${formatNumber(analysis.growthVelocity)} cm/Jahr`
                    : "",
                )}
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Wachstumskurve</h2>
            <GrowthChart
              points={analysis.points}
              predictions={analysis.predictions}
              projection={analysis.projection}
              sex={profile.sex}
            />
            <p className="mt-3 text-xs text-foreground/50">
              Schattiert: Unsicherheit der Prognose (Khamis-Roche 90 %, Elterngröße ±8,5 cm).
              Khamis-Roche gilt für 4 bis 17,5 Jahre. Fortschreibung: aktuelle Rate, die linear bis{" "}
              {profile.sex === "male" ? "19" : "17"} Jahre ausläuft, ohne Modell für den
              Wachstumsschub.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Wachstumsgeschwindigkeit</h2>
            <GrowthVelocityChart
              velocity={analysis.velocity}
              sex={profile.sex}
              peak={analysis.peak}
            />
            <p className="mt-3 text-xs text-foreground/50">
              {analysis.peak.status === "confirmed" ? "" : `${analysis.peak.note} `}
              Bänder: Gipfelalter früh, normal, spät (Kozieł & Malina 2018). Gepunktet: Median der
              KiGGS-Referenz, glättet den Schub.
            </p>
          </section>

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
