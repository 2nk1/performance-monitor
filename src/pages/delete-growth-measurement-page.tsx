import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchGrowthMeasurement, fetchParticipantById, queryKeys } from "@/lib/data";
import { formatTestDate } from "@/lib/format";
import { deleteGrowthMeasurement } from "@/lib/mutations";
import { useMutationWithError } from "@/lib/use-mutation-with-error";
import { NotFoundPage } from "@/pages/not-found-page";

export function DeleteGrowthMeasurementPage() {
  const { id, measurementId } = useParams<{ id: string; measurementId: string }>();
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
    enabled: !!id && !!measurementId,
  });

  const { mutation, errorMessage } = useMutationWithError({
    mutationFn: async () => {
      if (!id || !measurementId) {
        throw new Error("Fehlende IDs.");
      }

      await deleteGrowthMeasurement(id, measurementId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.growthMeasurementsByParticipant(id ?? ""),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.growthComparison });
      if (id) {
        navigate(`/athletes/${id}/growth`);
      }
    },
    errorFallback: "Löschen fehlgeschlagen.",
  });

  if (participantQuery.isPending || measurementQuery.isPending) {
    return <p className="text-sm text-foreground/60">Lade Messung...</p>;
  }

  if (!id || !measurementId) {
    return <NotFoundPage />;
  }

  const error = participantQuery.error ?? measurementQuery.error;
  if (error) {
    return <p className="text-sm text-red-400">{error.message}</p>;
  }

  const participant = participantQuery.data;
  const measurement = measurementQuery.data;

  if (!participant || !measurement) {
    return <NotFoundPage />;
  }

  const editPath = `/athletes/${participant.id}/growth/measurements/${measurement.id}/edit`;

  return (
    <>
      <header className="mb-8">
        <Link to={editPath} className="text-sm text-foreground/60 hover:text-foreground">
          {"<- Zurück"}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Messung löschen</h1>
      </header>

      <div className="max-w-xl rounded-xl border border-red-900/40 bg-card p-6">
        <p className="font-medium">Möchtest du diese Wachstumsmessung wirklich löschen?</p>

        <div className="mt-4 text-sm text-foreground/70">
          <p>{participant.name}</p>
          <p>
            {formatTestDate(measurement.measured_at)} · {measurement.height_cm} cm
          </p>
        </div>

        <p className="mt-4 text-sm text-red-400">Die Messung wird dauerhaft gelöscht.</p>
        {errorMessage ? <p className="mt-3 text-sm text-red-400">{errorMessage}</p> : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
          >
            {mutation.isPending ? "Löscht..." : "Endgültig löschen"}
          </button>

          <Link
            to={editPath}
            className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-sage/20"
          >
            Abbrechen
          </Link>
        </div>
      </div>
    </>
  );
}
