export function requireString(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} fehlt.`);
  }

  return value.trim();
}

export function parseNullableNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error("Ungültiger Zahlenwert.");
  }

  return parsed;
}

export function parseOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function parseParticipantType(value: FormDataEntryValue | null): "athlete" | "reference" {
  if (value === "athlete" || value === "reference") {
    return value;
  }

  throw new Error("Ungültiger Typ.");
}

export type PerformanceTestFormValues = {
  testDate: string;
  ageGroup: string | null;
  reachHeight: number | null;
  jumpReach: number | null;
  sprint: number | null;
  ballControl: number | null;
};

/** Liest und validiert die Felder des Leistungstest-Formulars (Neuanlage & Bearbeitung). */
export function parsePerformanceTestForm(formData: FormData): PerformanceTestFormValues {
  return {
    testDate: requireString(formData.get("test_date"), "Testdatum"),
    ageGroup: parseOptionalString(formData.get("age_group")),
    reachHeight: parseNullableNumber(formData.get("reach_height_cm")),
    jumpReach: parseNullableNumber(formData.get("jump_reach_cm")),
    sprint: parseNullableNumber(formData.get("sprint_93639_seconds")),
    ballControl: parseNullableNumber(formData.get("ball_control_count")),
  };
}

export type GrowthProfileFormValues = {
  sex: "male" | "female";
  birthDate: string;
  motherHeight: number | null;
  fatherHeight: number | null;
  maturityOverride: "early" | "average" | "late" | null;
  maturityDelay: number | null;
};

function parseMaturityOverride(
  value: FormDataEntryValue | null,
): "early" | "average" | "late" | null {
  if (value === "early" || value === "average" || value === "late") {
    return value;
  }

  return null;
}

function parseMaturityDelay(value: FormDataEntryValue | null): number | null {
  const delay = parseNullableNumber(value);

  if (delay !== null && (delay < -4 || delay > 6)) {
    throw new Error("Die Entwicklungsverzögerung muss zwischen -4 und 6 Jahren liegen.");
  }

  return delay;
}

export function parseGrowthProfileForm(formData: FormData): GrowthProfileFormValues {
  const sex = formData.get("sex");

  if (sex !== "male" && sex !== "female") {
    throw new Error("Geschlecht fehlt.");
  }

  return {
    sex,
    birthDate: requireString(formData.get("birth_date"), "Geburtsdatum"),
    motherHeight: parseNullableNumber(formData.get("mother_height_cm")),
    fatherHeight: parseNullableNumber(formData.get("father_height_cm")),
    maturityOverride: parseMaturityOverride(formData.get("maturity_override")),
    maturityDelay: parseMaturityDelay(formData.get("maturity_delay_years")),
  };
}

export type GrowthMeasurementFormValues = {
  measuredAt: string;
  height: number;
  weight: number | null;
  sittingHeight: number | null;
  armSpan: number | null;
  notes: string | null;
};

export function parseGrowthMeasurementForm(formData: FormData): GrowthMeasurementFormValues {
  const height = parseNullableNumber(formData.get("height_cm"));

  if (height === null) {
    throw new Error("Körpergröße fehlt.");
  }

  const sittingHeight = parseNullableNumber(formData.get("sitting_height_cm"));

  if (sittingHeight !== null && sittingHeight >= height) {
    throw new Error("Die Sitzhöhe muss kleiner als die Körpergröße sein.");
  }

  return {
    measuredAt: requireString(formData.get("measured_at"), "Messdatum"),
    height,
    weight: parseNullableNumber(formData.get("weight_kg")),
    sittingHeight,
    armSpan: parseNullableNumber(formData.get("arm_span_cm")),
    notes: parseOptionalString(formData.get("notes")),
  };
}
