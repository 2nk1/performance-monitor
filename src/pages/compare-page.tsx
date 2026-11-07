import { useQuery } from "@tanstack/react-query";
import { GrowthComparison } from "@/components/growth-comparison";
import { PerformanceComparison } from "@/components/performance-comparison";
import { PerformanceDevelopment } from "@/components/performance-development";
import { PerformanceRanking } from "@/components/performance-ranking";
import { fetchComparisonTests, queryKeys } from "@/lib/data";
import { compareModes, type CompareMode } from "@/lib/compare-modes";

const modeLabels = Object.fromEntries(
  compareModes.map((item) => [item.mode, item.label]),
) as Record<CompareMode, string>;

type ComparePageProps = {
  mode: CompareMode;
};

/**
 * Die Unteransichten sind eigene Sidebar-Einträge (siehe `AppShell`) statt
 * eines Segmented Controls im Content-Bereich, jeweils eine echte Route
 * (`/compare`, `/compare/ranking`, `/compare/development`, `/compare/growth`)
 * statt internem State – dadurch bleibt die Auswahl in der URL, per
 * Vor-/Zurück erreichbar, und diese Seite muss nur noch den zur Route
 * passenden Modus rendern. „Wachstum“ basiert auf Wachstumsmessungen statt
 * Leistungstests und lädt seine Daten deshalb selbst.
 */
export function ComparePage({ mode }: ComparePageProps) {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{modeLabels[mode]}</h1>
      </header>

      {mode === "growth" ? <GrowthComparison /> : <PerformanceTestsView mode={mode} />}
    </>
  );
}

function PerformanceTestsView({ mode }: { mode: Exclude<CompareMode, "growth"> }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.comparison,
    queryFn: fetchComparisonTests,
  });

  if (isPending) {
    return <p className="text-sm text-foreground/60">Lade Vergleichsdaten...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-400">{error.message}</p>;
  }

  return mode === "comparison" ? (
    <PerformanceComparison tests={data} />
  ) : mode === "ranking" ? (
    <PerformanceRanking tests={data} />
  ) : (
    <PerformanceDevelopment tests={data} />
  );
}
