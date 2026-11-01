import { NumberField } from "@/components/number-field";
import type { GrowthMeasurement } from "@/lib/types";

type GrowthMeasurementFieldsProps = {
  defaultValues?: Pick<
    GrowthMeasurement,
    "measured_at" | "height_cm" | "weight_kg" | "sitting_height_cm" | "notes"
  >;
};

/** Gemeinsame Formularfelder für Neuanlage und Bearbeitung einer Wachstumsmessung. */
export function GrowthMeasurementFields({ defaultValues }: GrowthMeasurementFieldsProps) {
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="measured_at" className="mb-1 block text-sm font-medium">
            Messdatum
          </label>
          <input
            id="measured_at"
            name="measured_at"
            type="date"
            required
            defaultValue={defaultValues?.measured_at}
            className="w-full rounded-lg border border-card-border px-3 py-2"
          />
        </div>

        <NumberField
          id="height_cm"
          label="Körpergröße"
          unit="cm"
          min="50"
          step="0.1"
          defaultValue={defaultValues?.height_cm}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <NumberField
          id="weight_kg"
          label="Gewicht (für Khamis-Roche)"
          unit="kg"
          min="5"
          step="0.1"
          defaultValue={defaultValues?.weight_kg}
        />
        <NumberField
          id="sitting_height_cm"
          label="Sitzhöhe (optional)"
          unit="cm"
          min="1"
          step="0.1"
          defaultValue={defaultValues?.sitting_height_cm}
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">
          Notiz
        </label>
        <input
          id="notes"
          name="notes"
          type="text"
          defaultValue={defaultValues?.notes ?? ""}
          className="w-full rounded-lg border border-card-border px-3 py-2"
        />
      </div>
    </>
  );
}
