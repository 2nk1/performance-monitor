import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { NumberField } from "@/components/number-field";
import { fetchGrowthProfile, fetchParticipantById, queryKeys } from "@/lib/data";
import { parseGrowthProfileForm } from "@/lib/forms";
import { saveGrowthProfile } from "@/lib/mutations";
import { useMutationWithError } from "@/lib/use-mutation-with-error";
import { NotFoundPage } from "@/pages/not-found-page";

export function EditGrowthProfilePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const { mutation, errorMessage } = useMutationWithError({
    mutationFn: async (formData: FormData) => {
      if (!id) {
        throw new Error("Fehlende ID.");
      }

      await saveGrowthProfile(id, parseGrowthProfileForm(formData));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.growthProfile(id ?? "") });
      if (id) {
        navigate(`/athletes/${id}/growth`);
      }
    },
    errorFallback: "Speichern fehlgeschlagen.",
  });

  if (participantQuery.isPending || profileQuery.isPending) {
    return <p className="text-sm text-foreground/60">Lade Wachstumsprofil...</p>;
  }

  if (!id) {
    return <NotFoundPage />;
  }

  const error = participantQuery.error ?? profileQuery.error;
  if (error) {
    return <p className="text-sm text-red-400">{error.message}</p>;
  }

  const participant = participantQuery.data;
  if (!participant) {
    return <NotFoundPage />;
  }

  const profile = profileQuery.data;

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
          {profile ? "Wachstumsprofil bearbeiten" : "Wachstumsprofil anlegen"}
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
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="sex" className="mb-1 block text-sm font-medium">
              Geschlecht
            </label>
            <select
              id="sex"
              name="sex"
              required
              defaultValue={profile?.sex ?? ""}
              className="w-full rounded-lg border border-card-border px-3 py-2"
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              <option value="male">männlich</option>
              <option value="female">weiblich</option>
            </select>
          </div>

          <div>
            <label htmlFor="birth_date" className="mb-1 block text-sm font-medium">
              Geburtsdatum
            </label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              required
              defaultValue={
                profile?.birth_date ??
                (participant.birth_year ? `${participant.birth_year}-01-01` : undefined)
              }
              className="w-full rounded-lg border border-card-border px-3 py-2"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            id="mother_height_cm"
            label="Größe Mutter"
            unit="cm"
            min="100"
            step="0.1"
            defaultValue={profile?.mother_height_cm}
          />
          <NumberField
            id="father_height_cm"
            label="Größe Vater"
            unit="cm"
            min="100"
            step="0.1"
            defaultValue={profile?.father_height_cm}
          />
        </div>

        <p className="text-xs text-foreground/50">
          Die Größe beider leiblicher Eltern wird für Khamis-Roche und die Elterngröße-Prognose
          benötigt. Selbst angegebene Größen werden meist leicht überschätzt, gemessene Werte sind
          genauer.
        </p>

        {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {mutation.isPending ? "Speichert..." : "Profil speichern"}
          </button>

          <Link
            to={`/athletes/${participant.id}/growth`}
            className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-sage/20"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </>
  );
}
