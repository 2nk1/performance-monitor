import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { PerformanceLineChart } from "@/components/performance-line-chart";
import { ZIndexChart } from "@/components/z-index-chart";
import {
  fetchComparisonTests,
  fetchParticipantById,
  fetchPerformanceTestsByParticipant,
  queryKeys,
} from "@/lib/data";
import { formatTestDate } from "@/lib/format";
import { buildMetricTimeSeries, computeJumpHeight, metricConfig } from "@/lib/metrics";
import type { ComparisonMetric } from "@/lib/types";
import { buildZIndexData } from "@/lib/z-index";
import { NotFoundPage } from "@/pages/not-found-page";

/**
 * Reihenfolge der Entwicklungs-Charts (1 pro Messgröße + Z-Index als 6.
 * Panel). `metricConfig` ist bereits die einzige Quelle für Label/Einheit/
 * Richtung/Nachkommastellen jeder Messgröße (siehe `metrics.ts`) – hier wird
 * sie direkt wiederverwendet, statt sie ein weiteres Mal (mit dem Risiko
 * eines Copy-Paste-Fehlers, z. B. falsche Einheit) zu duplizieren.
 */
const developmentChartMetrics = Object.keys(metricConfig) as ComparisonMetric[];

export function AthleteDetailPage() {
  const { id } = useParams<{ id: string }>();

  const participantQuery = useQuery({
    queryKey: queryKeys.participant(id ?? ""),
    queryFn: () => fetchParticipantById(id ?? ""),
    enabled: !!id,
  });

  const testsQuery = useQuery({
    queryKey: queryKeys.performanceTestsByParticipant(id ?? ""),
    queryFn: () => fetchPerformanceTestsByParticipant(id ?? ""),
    enabled: !!id && !!participantQuery.data,
  });

  // Für den Z-Index (6. Panel) wird die Vergleichspopulation aller
  // Athlet:innen benötigt (Mittelwert/Std.-Abw. je Altersklasse), nicht nur
  // die Tests dieser einen Person. `queryKeys.comparison` teilt den Cache mit
  // der Vergleichsseite, dadurch meist kein zusätzlicher Request nötig.
  const comparisonQuery = useQuery({
    queryKey: queryKeys.comparison,
    queryFn: fetchComparisonTests,
    enabled: !!id && !!participantQuery.data,
  });

  // Einmal pro Test die abgeleitete Sprunghöhe berechnen und sowohl für die
  // Charts (aufsteigend) als auch die Tabelle (absteigend) wiederverwenden.
  const testsWithJumpHeight = useMemo(
    () => (testsQuery.data ?? []).map((test) => ({ ...test, jumpHeight: computeJumpHeight(test) })),
    [testsQuery.data],
  );

  const chronologicalTests = useMemo(
    () => [...testsWithJumpHeight].reverse(),
    [testsWithJumpHeight],
  );

  const timeSeriesByMetric = useMemo(
    () =>
      Object.fromEntries(
        developmentChartMetrics.map((metric) => [
          metric,
          buildMetricTimeSeries(chronologicalTests, metric, (test) => formatTestDate(test.test_date)),
        ]),
      ) as Record<ComparisonMetric, ReturnType<typeof buildMetricTimeSeries>>,
    [chronologicalTests],
  );

  const zIndexData = useMemo(
    () => (id ? buildZIndexData(comparisonQuery.data ?? [], id) : { points: [], series: [] }),
    [comparisonQuery.data, id],
  );

  if (participantQuery.isPending || testsQuery.isPending) {
    return <p className="text-sm text-foreground/60">Lade Athlet:in...</p>;
  }

  if (!id) {
    return <NotFoundPage />;
  }

  if (participantQuery.isError) {
    return <p className="text-sm text-red-400">{participantQuery.error.message}</p>;
  }

  if (testsQuery.isError) {
    return <p className="text-sm text-red-400">{testsQuery.error.message}</p>;
  }

  const participant = participantQuery.data;

  if (!participant) {
    return <NotFoundPage />;
  }

  const tests = testsWithJumpHeight;

  return (
    <>
      <header className="mb-8">
        <Link to="/athletes" className="text-sm text-foreground/60 hover:text-foreground">
          {"<- Athlet:innen"}
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{participant.name}</h1>
            <p className="mt-2 text-sm text-foreground/60">
              {participant.birth_year ? `Jahrgang ${participant.birth_year}` : "Kein Jahrgang"} ·{" "}
              {participant.participant_type === "reference" ? "Referenz" : "Athlet:in"}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to={`/athletes/${participant.id}/growth`}
              className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-sage/20"
            >
              Wachstum
            </Link>

            <Link
              to={`/athletes/${participant.id}/edit`}
              className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-sage/20"
            >
              Bearbeiten
            </Link>

            <Link
              to={`/athletes/${participant.id}/tests/new`}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Test hinzufügen
            </Link>
          </div>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Entwicklung</h2>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {developmentChartMetrics.map((metric) => {
            const config = metricConfig[metric];

            return (
              <PerformanceLineChart
                key={metric}
                title={config.label}
                unit={config.unit}
                data={timeSeriesByMetric[metric]}
                betterDirection={config.betterDirection}
                decimals={config.decimals}
              />
            );
          })}
          <ZIndexChart points={zIndexData.points} series={zIndexData.series} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Leistungstests</h2>

        <div className="overflow-hidden rounded-xl border border-card-border bg-card">
          <div className="grid grid-cols-[110px_100px_repeat(5,1fr)_80px] gap-4 border-b border-card-border px-5 py-3 text-sm font-medium text-foreground/60">
            <span>Datum</span>
            <span>Altersklasse</span>
            <span>Reichhöhe im Stand</span>
            <span>Reichhöhe im Sprung</span>
            <span>Sprung absolut</span>
            <span>9-3-6-3-9</span>
            <span>Ballkontrolle</span>
            <span></span>
          </div>

          {tests.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-foreground/60">
              Noch keine Leistungstests vorhanden.
            </div>
          ) : (
            tests.map((test) => {
              return (
                <div
                  key={test.id}
                  className="grid grid-cols-[110px_100px_repeat(5,1fr)_80px] gap-4 border-b border-card-border/50 px-5 py-4 text-sm last:border-b-0"
                >
                  <span>{formatTestDate(test.test_date)}</span>
                  <span>{test.age_group ?? "-"}</span>
                  <span>{test.reach_height_cm !== null ? `${test.reach_height_cm} cm` : "-"}</span>
                  <span>{test.jump_reach_cm !== null ? `${test.jump_reach_cm} cm` : "-"}</span>
                  <span>{test.jumpHeight !== null ? `${test.jumpHeight} cm` : "-"}</span>
                  <span>
                    {test.sprint_93639_seconds !== null ? `${test.sprint_93639_seconds} s` : "-"}
                  </span>
                  <span>{test.ball_control_count ?? "-"}</span>
                  <Link
                    to={`/athletes/${participant.id}/tests/${test.id}/edit`}
                    className="text-sm font-medium text-foreground/70 hover:text-foreground"
                  >
                    Ändern
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
