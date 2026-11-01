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
import {
  ageInYears,
  buildGrowthAnalysis,
  maturityStageLabels,
  type GrowthAnalysis,
} from "@/lib/growth/analysis";
import { predictionColors } from "@/lib/growth/colors";
import { PHV_TIMING_THRESHOLDS, timingLabels } from "@/lib/growth/timing";
import type { GrowthSex } from "@/lib/types";
import { NotFoundPage } from "@/pages/not-found-page";

const formatNumber = (value: number, decimals = 1) =>
  value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

function timingHeadline(
  timing: NonNullable<GrowthAnalysis["timing"]>,
  latestAge: number | null,
  sex: GrowthSex,
): string {
  switch (timing.source) {
    case "manual":
      return "Manuell festgelegt";
    case "observed":
      return `Gipfel bei ${formatNumber(timing.phvAge ?? 0)} J. (beobachtet)`;
    case "presumed":
      return `Bis ${formatNumber(latestAge ?? 0)} J. noch kein Gipfel (Spät-Grenze ${formatNumber(PHV_TIMING_THRESHOLDS[sex].late)} J.)`;
    case "estimated":
      return `Wachstumsschub geschätzt bei ${formatNumber(timing.phvAge ?? 0)} J.`;
  }
}

function timingFootnote(
  source: NonNullable<GrowthAnalysis["timing"]>["source"],
  peak: GrowthAnalysis["peak"],
  equation: string | undefined,
): string {
  switch (source) {
    case "estimated":
      return `Schätzung nach Moore (${equation}, ±0,5 Jahre). Sie zieht Früh- und Spätentwickler Richtung Durchschnitt, Bestätigung durch den beobachteten Gipfel folgt.`;
    case "presumed":
      return "Vorläufig: Trotz regelmäßiger Messungen ist noch kein Wachstumsschub zu sehen. Ein flacher Schub kann im Messrauschen untergehen, Bestätigung folgt mit dem beobachteten Gipfel.";
    case "manual":
      return peak.status === "confirmed"
        ? `Automatisch beobachtet: Gipfel bei ${formatNumber(peak.age ?? 0)} J.`
        : peak.note;
    case "observed":
      return `Spitze ${formatNumber(peak.velocity ?? 0)} cm/Jahr`;
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
            {analysis.predictions.map((prediction) => (
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
                {(() => {
                  const footer =
                    prediction.basisDate && prediction.basisDate !== analysis.latest?.measured_at
                      ? `Stand: Messung vom ${formatTestDate(prediction.basisDate)} (letzte Messung mit Gewicht)`
                      : prediction.description;

                  return footer ? (
                    <p className="mt-3 text-xs text-foreground/50">{footer}</p>
                  ) : null;
                })()}
              </div>
            ))}

            <div className="rounded-xl border border-card-border bg-card p-5">
              <p className="text-sm text-foreground/60">Reifestatus</p>
              {analysis.percentOfTarget !== null ? (
                <>
                  <p className="mt-2 text-3xl font-semibold">
                    {formatNumber(analysis.percentOfTarget)} %
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">
                    {analysis.maturity?.stage ? maturityStageLabels[analysis.maturity.stage] : ""}
                  </p>
                  <p className="mt-3 text-xs text-foreground/50">
                    Aktuelle Größe im Verhältnis zur Khamis-Roche-Zielgröße
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-foreground/60">
                  Nicht berechenbar, braucht die Khamis-Roche-Zielgröße.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-card-border bg-card p-5">
              <p className="text-sm text-foreground/60">Entwicklungstyp</p>
              {analysis.timing ? (
                <>
                  <p className="mt-2 text-2xl font-semibold">
                    {analysis.timing.source === "presumed"
                      ? "Möglicherweise spät"
                      : timingLabels[analysis.timing.timing]}
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">
                    {timingHeadline(analysis.timing, analysis.latest?.age ?? null, profile.sex)}
                    {analysis.growthVelocity !== null
                      ? ` · aktuell ${formatNumber(analysis.growthVelocity)} cm/Jahr`
                      : ""}
                  </p>
                  <p className="mt-3 text-xs text-foreground/50">
                    {timingFootnote(
                      analysis.timing.source,
                      analysis.peak,
                      analysis.maturity?.equation,
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-foreground/60">Noch nicht einstufbar.</p>
                  <p className="mt-3 text-xs text-foreground/50">{analysis.peak.note}</p>
                </>
              )}
            </div>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Wachstumskurve</h2>
            <GrowthChart points={analysis.points} predictions={analysis.predictions} />
            <p className="mt-3 text-xs text-foreground/50">
              Schattierte Bereiche: Unsicherheit der Prognose (Khamis-Roche: 90-%-Fehlergrenze,
              Elterngröße: ±8,5 cm). Khamis-Roche gilt von 4 bis 17,5 Jahren und ist rund um den
              Wachstumsschub am ungenauesten, besonders bei sehr frühen oder späten Entwicklern.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Wachstumsgeschwindigkeit</h2>
            <GrowthVelocityChart
              velocity={analysis.velocity}
              sex={profile.sex}
              peak={analysis.peak}
              estimatedPhvAge={
                analysis.timing?.source === "estimated" ? analysis.timing.phvAge : null
              }
            />
            <p className="mt-3 text-xs text-foreground/50">
              {analysis.peak.status === "confirmed"
                ? `Der Gipfel der Wachstumsgeschwindigkeit wurde beobachtet. `
                : `${analysis.peak.note} `}
              Die Bänder zeigen, in welchem Alter der Gipfel bei früh, normal und spät entwickelnden{" "}
              {profile.sex === "male" ? "Jungen" : "Mädchen"} liegt (Kozieł & Malina 2018). Einzelne
              Intervalle schwanken durch Messfehler, die Linie ist deshalb geglättet.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">Messungen</h2>

            <div className="overflow-x-auto rounded-xl border border-card-border bg-card">
              <div className="grid min-w-[760px] grid-cols-[100px_70px_repeat(5,1fr)_70px] gap-4 border-b border-card-border px-5 py-3 text-sm font-medium text-foreground/60">
                <span>Datum</span>
                <span>Alter</span>
                <span>Größe</span>
                <span>Gewicht</span>
                <span>Sitzhöhe</span>
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
                    className="grid min-w-[760px] grid-cols-[100px_70px_repeat(5,1fr)_70px] gap-4 border-b border-card-border/50 px-5 py-4 text-sm last:border-b-0"
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
