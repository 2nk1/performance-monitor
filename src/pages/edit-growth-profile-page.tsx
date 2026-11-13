import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { NumberField } from "@/components/number-field";
import { fetchGrowthProfile, fetchParticipantById, queryKeys } from "@/lib/data";
import { parseGrowthProfileForm, parseOptionalDate } from "@/lib/forms";
import { saveGrowthProfile, saveParticipantBirthDate } from "@/lib/mutations";
import { formatTestDate } from "@/lib/format";
import { useMutationWithError } from "@/lib/use-mutation-with-error";
import { NotFoundPage } from "@/pages/not-found-page";

export function EditGrowthProfilePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Hinweis von der Athlet:innen-Seite, falls dort nur das Profil nicht gespeichert werden konnte.
  const notice = (useLocation().state as { notice?: string } | null)?.notice ?? null;

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

      // Das Geburtsdatum liegt beim Athleten und wird nur abgefragt, solange es fehlt.
      const birthDate = parseOptionalDate(formData.get("birth_date"), "Geburtsdatum");

      if (!participantQuery.data?.birth_date && !birthDate) {
        throw new Error("Geburtsdatum fehlt.");
      }

      const values = parseGrowthProfileForm(formData);

      if (birthDate) {
        await saveParticipantBirthDate(id, birthDate);
      }

      await saveGrowthProfile(id, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.growthProfile(id ?? "") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.participant(id ?? "") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.participants });
      await queryClient.invalidateQueries({ queryKey: queryKeys.growthComparison });
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
        {notice ? <p className="mt-3 text-sm text-red-400">{notice}</p> : null}
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

          {participant.birth_date ? (
            <div>
              <p className="mb-1 text-sm font-medium">Geburtsdatum</p>
              <p className="px-3 py-2 text-sm">
                {formatTestDate(participant.birth_date)}{" "}
                <Link
                  to={`/athletes/${participant.id}/edit`}
                  className="text-foreground/60 underline hover:text-foreground"
                >
                  ändern
                </Link>
              </p>
            </div>
          ) : (
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
                  participant.birth_year ? `${participant.birth_year}-01-01` : undefined
                }
                className="w-full rounded-lg border border-card-border px-3 py-2"
              />
            </div>
          )}
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

        <div>
          <NumberField
            id="maturity_delay_years"
            label="Entwicklungsverzögerung (optional)"
            unit="Jahre"
            min="-4"
            step="0.5"
            defaultValue={profile?.maturity_delay_years}
          />
          <p className="mt-1 text-xs text-foreground/50">
            Wie viele Jahre der Spieler hinter den Gleichaltrigen liegt (negativ: früher). Die
            Khamis-Roche-Zielgröße wird zusätzlich mit diesem Entwicklungsalter berechnet.
          </p>
        </div>

        <div>
          <label htmlFor="maturity_override" className="mb-1 block text-sm font-medium">
            Entwicklungstyp (optional)
          </label>
          <select
            id="maturity_override"
            name="maturity_override"
            defaultValue={profile?.maturity_override ?? ""}
            className="w-full rounded-lg border border-card-border px-3 py-2"
          >
            <option value="">Automatisch aus den Messungen</option>
            <option value="early">Frühentwickler</option>
            <option value="average">Normal entwickelt</option>
            <option value="late">Spätentwickler</option>
          </select>
          <p className="mt-1 text-xs text-foreground/50">
            Überschreibt die automatische Einstufung, z. B. wenn der Verlauf unklar ist oder du den
            Spieler gut kennst.
          </p>
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
