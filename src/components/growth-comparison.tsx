import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { BirthYearMultiSelect } from "@/components/birth-year-multi-select";
import { GrowthComparisonChart } from "@/components/growth-comparison-chart";
import { fetchGrowthComparison, queryKeys } from "@/lib/data";
import {
  MAX_GROWTH_COMPARISON_SERIES,
  buildGrowthComparisonData,
  parseSelectedIds,
} from "@/lib/growth/comparison";
import { getSeriesColor } from "@/lib/series-colors";

/**
 * Wachstumskurven von bis zu 9 Personen übereinander. Die Auswahl liegt in
 * `?ids=…` (Reihenfolge = Farbreihenfolge), damit sie teilbar ist und die
 * Wachstumsseite einer Person direkt mit dieser Person vorausgewählt
 * hierher verlinken kann.
 */
export function GrowthComparison() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.growthComparison,
    queryFn: fetchGrowthComparison,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [birthYears, setBirthYears] = useState<number[]>([]);

  const athletes = useMemo(() => data ?? [], [data]);
  const selectedIds = useMemo(
    () => parseSelectedIds(searchParams.get("ids"), new Set(athletes.map((a) => a.id))),
    [searchParams, athletes],
  );
  const selected = useMemo(
    () => selectedIds.flatMap((id) => athletes.find((athlete) => athlete.id === id) ?? []),
    [selectedIds, athletes],
  );
  const chartData = useMemo(() => buildGrowthComparisonData(selected), [selected]);

  const availableBirthYears = useMemo(
    () =>
      [...new Set(athletes.map((a) => a.birth_year).filter((y): y is number => y !== null))].sort(
        (a, b) => b - a,
      ),
    [athletes],
  );
  const visible = athletes.filter(
    (athlete) =>
      birthYears.length === 0 ||
      (athlete.birth_year !== null && birthYears.includes(athlete.birth_year)),
  );
  const isFull = selectedIds.length >= MAX_GROWTH_COMPARISON_SERIES;

  function setSelection(ids: string[]) {
    setSearchParams(
      (params) => {
        if (ids.length === 0) {
          params.delete("ids");
        } else {
          params.set("ids", ids.join(","));
        }
        return params;
      },
      { replace: true },
    );
  }

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      setSelection(selectedIds.filter((selectedId) => selectedId !== id));
    } else if (!isFull) {
      setSelection([...selectedIds, id]);
    }
  }

  if (isPending) {
    return <p className="text-sm text-foreground/60">Lade Wachstumsdaten...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-400">{error.message}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-card-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <BirthYearMultiSelect
            availableYears={availableBirthYears}
            selectedYears={birthYears}
            onChange={setBirthYears}
          />

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium">
                Personen ({selectedIds.length}/{MAX_GROWTH_COMPARISON_SERIES})
              </label>
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelection([])}
                  className="text-xs font-medium text-foreground/60 hover:text-foreground"
                >
                  Zurücksetzen
                </button>
              ) : null}
            </div>

            <div className="flex max-h-32 min-h-10 flex-wrap gap-1 overflow-y-auto rounded-lg border border-card-border px-2 py-1.5">
              {visible.length === 0 ? (
                <span className="py-0.5 text-sm text-foreground/50">
                  Keine Personen mit Wachstumsprofil vorhanden
                </span>
              ) : (
                visible.map((athlete) => {
                  const index = selectedIds.indexOf(athlete.id);
                  const isSelected = index !== -1;
                  const disabled = !isSelected && isFull;

                  return (
                    <button
                      key={athlete.id}
                      type="button"
                      onClick={() => toggle(athlete.id)}
                      disabled={disabled}
                      title={
                        disabled
                          ? `Maximal ${MAX_GROWTH_COMPARISON_SERIES} Personen`
                          : athlete.measurements.length === 0
                            ? "Noch keine Messungen"
                            : undefined
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        isSelected
                          ? "bg-primary/20 text-foreground ring-1 ring-primary/60"
                          : "bg-card-border/40 text-foreground/70 hover:bg-card-border/60"
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: getSeriesColor(index) }}
                        />
                      ) : null}
                      {athlete.name}
                      <span className="text-foreground/40">
                        {athlete.sex === "male" ? "m" : "w"}
                        {athlete.measurements.length === 0 ? " · –" : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {selected.length === 0 ? (
        <div className="flex h-72 items-center justify-center rounded-xl border border-card-border bg-card text-sm text-foreground/60">
          Bis zu {MAX_GROWTH_COMPARISON_SERIES} Personen auswählen, um ihre Wachstumskurven zu
          vergleichen.
        </div>
      ) : chartData ? (
        <GrowthComparisonChart data={chartData} />
      ) : (
        <div className="flex h-72 items-center justify-center rounded-xl border border-card-border bg-card text-sm text-foreground/60">
          Für die Auswahl sind noch keine Messungen vorhanden.
        </div>
      )}
    </div>
  );
}
