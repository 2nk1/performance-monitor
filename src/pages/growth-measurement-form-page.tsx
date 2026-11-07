import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GrowthMeasurementFields } from "@/components/growth-measurement-fields";
import { fetchGrowthMeasurement, fetchParticipantById, queryKeys } from "@/lib/data";
import { parseGrowthMeasurementForm } from "@/lib/forms";
import { createGrowthMeasurement, updateGrowthMeasurement } from "@/lib/mutations";
import { useMutationWithError } from "@/lib/use-mutation-with-error";
import { NotFoundPage } from "@/pages/not-found-page";

/**
 * Neuanlage (ohne `:measurementId` in der Route) und Bearbeitung einer
 * Wachstumsmessung in einer Seite.
 */
export function GrowthMeasurementFormPage() {
  const { id, measurementId } = useParams<{ id: string; measurementId?: string }>();
  const isEdit = !!measurementId;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const participantQuery = useQuery({
    queryKey: queryKeys.participant(id ?? ""),
    queryFn: () => fetchParticipantById(id ?? ""),
    enabled: !!id,
  });

  const measurementQuery = useQuery({
    queryKey: queryKeys.growthMeasurement(id ?? "", measurementId ?? ""),
    queryFn: () => fetchGrowthMeasurement(id ?? "", measurementId ?? ""),
    enabled: !!id && isEdit,
  });

  const { mutation, errorMessage } = useMutationWithError({
    mutationFn: async (formData: FormData) => {
      const values = parseGrowthMeasurementForm(formData);

      if (!id) {
        throw new Error("Fehlende ID.");
      }

      if (measurementId) {
        await updateGrowthMeasurement(id, measurementId, values);
      } else {
        await createGrowthMeasurement(id, values);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.growthMeasurementsByParticipant(id ?? ""),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.growthComparison });
      if (measurementId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.growthMeasurement(id ?? "", measurementId),
        });
      }
      if (id) {
        navigate(`/athletes/${id}/growth`);
      }
    },
    errorFallback: "Speichern fehlgeschlagen.",
  });

  if (participantQuery.isPending || (isEdit && measurementQuery.isPending)) {
    return <p className="text-sm text-foreground/60">Lade Messung...</p>;
  }

  if (!id) {
    return <NotFoundPage />;
  }

  const error = participantQuery.error ?? measurementQuery.error;
  if (error) {
    return <p className="text-sm text-red-400">{error.message}</p>;
  }

  const participant = participantQuery.data;
  const measurement = measurementQuery.data;

  if (!participant || (isEdit && !measurement)) {
    return <NotFoundPage />;
  }

  return (
    <>
      <header className="mb-8">
        <Link
          to={`/athletes/${participant.id}/growth`}
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          {"<- Wachstum"}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {isEdit ? "Messung bearbeiten" : "Messung hinzufügen"}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">{participant.name}</p>
      </header>

      <form
        className="max-w-2xl space-y-6 rounded-xl border border-card-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <GrowthMeasurementFields defaultValues={measurement ?? undefined} />

        {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {mutation.isPending ? "Speichert..." : "Messung speichern"}
          </button>

          <Link
            to={`/athletes/${participant.id}/growth`}
            className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-sage/20"
          >
            Abbrechen
          </Link>

          {measurement ? (
            <Link
              to={`/athletes/${participant.id}/growth/measurements/${measurement.id}/delete`}
              className="ml-auto rounded-lg border border-red-800/50 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/40"
            >
              Messung löschen
            </Link>
          ) : null}
        </div>
      </form>
    </>
  );
}
