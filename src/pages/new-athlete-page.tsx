import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { NumberField } from "@/components/number-field";
import {
  parseGrowthProfileForm,
  parseNullableNumber,
  parseOptionalDate,
  parseParticipantType,
  requireString,
} from "@/lib/forms";
import { createParticipant, saveGrowthProfile } from "@/lib/mutations";
import { queryKeys } from "@/lib/data";
import { useMutationWithError } from "@/lib/use-mutation-with-error";

export function NewAthletePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [withGrowthProfile, setWithGrowthProfile] = useState(false);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.participants });
    await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    await queryClient.invalidateQueries({ queryKey: queryKeys.growthComparison });
  };

  const { mutation, errorMessage } = useMutationWithError({
    mutationFn: async (formData: FormData) => {
      const name = requireString(formData.get("name"), "Name");
      const participantType = parseParticipantType(formData.get("participant_type"));

      // Mit Wachstumsprofil gibt es das volle Geburtsdatum, sonst nur den Jahrgang.
      const birthDate = withGrowthProfile
        ? parseOptionalDate(formData.get("birth_date"), "Geburtsdatum")
        : null;

      if (withGrowthProfile && !birthDate) {
        throw new Error("Geburtsdatum fehlt.");
      }

      // Vor dem Anlegen prüfen, damit bei fehlendem Geschlecht kein halber Athlet entsteht.
      const profile = withGrowthProfile ? parseGrowthProfileForm(formData) : null;

      const id = await createParticipant({
        name,
        participantType,
        birthYear: parseNullableNumber(formData.get("birth_year")),
        birthDate,
      });

      if (!profile) {
        return { id, profileError: null };
      }

      try {
        await saveGrowthProfile(id, profile);
        return { id, profileError: null };
      } catch (error) {
        return { id, profileError: error instanceof Error ? error.message : "Unbekannter Fehler." };
      }
    },
    onSuccess: async ({ id, profileError }) => {
      await invalidate();

      // Der Athlet existiert schon: Bei einem Fehler im Profil direkt ins Profilformular,
      // statt hier erneut zu speichern und einen Doppelten anzulegen.
      if (profileError) {
        navigate(`/athletes/${id}/growth/profile`, {
          state: {
            notice: `Athlet:in wurde angelegt, das Wachstumsprofil nicht: ${profileError}`,
          },
        });
        return;
      }

      navigate("/athletes");
    },
    errorFallback: "Speichern fehlgeschlagen.",
  });

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Athlet:in hinzufügen</h1>
      </header>

      <form
        className="max-w-xl space-y-6 rounded-xl border border-card-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-lg border border-card-border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="participant_type" className="mb-1 block text-sm font-medium">
            Typ
          </label>
          <select
            id="participant_type"
            name="participant_type"
            defaultValue="athlete"
            className="w-full rounded-lg border border-card-border px-3 py-2"
          >
            <option value="athlete">Athlet:in</option>
            <option value="reference">Referenz</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={withGrowthProfile}
            onChange={(event) => setWithGrowthProfile(event.target.checked)}
          />
          Wachstumsprofil anlegen
        </label>

        {withGrowthProfile ? (
          <div className="space-y-6">
            <div>
              <label htmlFor="birth_date" className="mb-1 block text-sm font-medium">
                Geburtsdatum
              </label>
              <input
                id="birth_date"
                name="birth_date"
                type="date"
                required
                className="w-full rounded-lg border border-card-border px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="sex" className="mb-1 block text-sm font-medium">
                Geschlecht
              </label>
              <select
                id="sex"
                name="sex"
                required
                defaultValue=""
                className="w-full rounded-lg border border-card-border px-3 py-2"
              >
                <option value="" disabled>
                  Bitte wählen
                </option>
                <option value="male">männlich</option>
                <option value="female">weiblich</option>
              </select>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <NumberField
                id="mother_height_cm"
                label="Größe Mutter (optional)"
                unit="cm"
                min="100"
                step="0.1"
              />
              <NumberField
                id="father_height_cm"
                label="Größe Vater (optional)"
                unit="cm"
                min="100"
                step="0.1"
              />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="birth_year" className="mb-1 block text-sm font-medium">
              Jahrgang
            </label>
            <input
              id="birth_year"
              name="birth_year"
              type="number"
              min="1900"
              max="2100"
              className="w-full rounded-lg border border-card-border px-3 py-2"
            />
          </div>
        )}

        {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {mutation.isPending ? "Speichert..." : "Speichern"}
        </button>
      </form>
    </>
  );
}
