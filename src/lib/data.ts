import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ComparisonTest,
  GrowthMeasurement,
  GrowthProfile,
  Participant,
  PerformanceTest,
} from "@/lib/types";

export const queryKeys = {
  authSession: ["auth", "session"] as const,
  dashboard: ["dashboard"] as const,
  participants: ["participants"] as const,
  participant: (id: string) => ["participants", id] as const,
  performanceTestsByParticipant: (id: string) => ["performance-tests", "participant", id] as const,
  performanceTest: (id: string, testId: string) => ["performance-tests", id, testId] as const,
  comparison: ["comparison"] as const,
  growthProfile: (id: string) => ["growth-profile", id] as const,
  growthMeasurementsByParticipant: (id: string) =>
    ["growth-measurements", "participant", id] as const,
  growthMeasurement: (id: string, measurementId: string) =>
    ["growth-measurements", id, measurementId] as const,
};

export async function fetchDashboardStats() {
  const [participantsResult, testsResult, athleteYearsResult, referencesResult] = await Promise.all(
    [
      supabase.from("participants").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("performance_tests").select("id", { count: "exact", head: true }),
      supabase
        .from("participants")
        .select("birth_year")
        .eq("active", true)
        .eq("participant_type", "athlete"),
      supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .eq("participant_type", "reference"),
    ],
  );

  if (
    participantsResult.error ||
    testsResult.error ||
    athleteYearsResult.error ||
    referencesResult.error
  ) {
    throw new Error(
      participantsResult.error?.message ||
        testsResult.error?.message ||
        athleteYearsResult.error?.message ||
        referencesResult.error?.message ||
        "Daten konnten nicht geladen werden.",
    );
  }

  const yearCount = new Set(
    (athleteYearsResult.data ?? [])
      .map((item) => item.birth_year)
      .filter((value): value is number => value !== null),
  ).size;

  return {
    participants: participantsResult.count ?? 0,
    tests: testsResult.count ?? 0,
    yearCount,
    references: referencesResult.count ?? 0,
  };
}

export async function fetchParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, birth_year, participant_type, active, created_at")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Athlet:innen konnten nicht geladen werden: ${error.message}`);
  }

  return data;
}

export async function fetchParticipantById(id: string): Promise<Participant | null> {
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, birth_year, participant_type, active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Athlet:in konnte nicht geladen werden: ${error.message}`);
  }

  return data;
}

export async function fetchPerformanceTestsByParticipant(id: string): Promise<PerformanceTest[]> {
  const { data, error } = await supabase
    .from("performance_tests")
    .select(
      "id, participant_id, test_date, age_group, reach_height_cm, jump_reach_cm, sprint_93639_seconds, ball_control_count, notes, created_at",
    )
    .eq("participant_id", id)
    .order("test_date", { ascending: false });

  if (error) {
    throw new Error(`Leistungstests konnten nicht geladen werden: ${error.message}`);
  }

  return data;
}

export async function fetchPerformanceTest(
  id: string,
  testId: string,
): Promise<PerformanceTest | null> {
  const { data, error } = await supabase
    .from("performance_tests")
    .select(
      "id, participant_id, test_date, age_group, reach_height_cm, jump_reach_cm, sprint_93639_seconds, ball_control_count, notes, created_at",
    )
    .eq("id", testId)
    .eq("participant_id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Leistungstest konnte nicht geladen werden: ${error.message}`);
  }

  return data;
}

export async function fetchComparisonTests(): Promise<ComparisonTest[]> {
  // `postgrest-js` leitet die Form von Embeds (Einzelobjekt vs. Array)
  // automatisch aus den `Relationships`-Metadaten in `database.types.ts` ab.
  // Da diese Datei von Hand statt per `supabase gen types` gepflegt wird
  // (kein lokales Supabase in dieser Umgebung), sind dort keine echten
  // Fremdschlüssel-Metadaten hinterlegt – die Auto-Inferenz würde daher
  // fälschlich einen Fehlertyp statt `participants` liefern. `.select<...>`
  // erlaubt es, das Ergebnis stattdessen explizit zu typisieren: Durch
  // `!inner` und die 1:n-Beziehung `performance_tests.participant_id ->
  // participants.id` liefert Postgrest hier immer genau ein Objekt, kein
  // Array.
  type Row = Database["public"]["Tables"]["performance_tests"]["Row"] & {
    participants: Pick<Participant, "id" | "name" | "birth_year" | "participant_type" | "active">;
  };

  const { data, error } = await supabase
    .from("performance_tests")
    .select<string, Row>(
      `
      id,
      participant_id,
      test_date,
      age_group,
      reach_height_cm,
      jump_reach_cm,
      sprint_93639_seconds,
      ball_control_count,
      notes,
      created_at,
      participants!inner (
        id,
        name,
        birth_year,
        participant_type,
        active
      )
    `,
    )
    .eq("participants.active", true)
    .order("test_date", { ascending: true });

  if (error) {
    throw new Error(`Vergleichsdaten konnten nicht geladen werden: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      const participant = row.participants;

      if (!participant) {
        return null;
      }

      return {
        id: row.id,
        test_date: row.test_date,
        age_group: row.age_group,
        reach_height_cm: row.reach_height_cm,
        jump_reach_cm: row.jump_reach_cm,
        sprint_93639_seconds: row.sprint_93639_seconds,
        ball_control_count: row.ball_control_count,
        participant,
      } satisfies ComparisonTest;
    })
    .filter((value): value is ComparisonTest => value !== null);
}

const GROWTH_MEASUREMENT_COLUMNS =
  "id, participant_id, measured_at, height_cm, weight_kg, sitting_height_cm, notes, created_at";

export async function fetchGrowthProfile(id: string): Promise<GrowthProfile | null> {
  const { data, error } = await supabase
    .from("growth_profiles")
    .select(
      "participant_id, sex, birth_date, mother_height_cm, father_height_cm, created_at, updated_at",
    )
    .eq("participant_id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Wachstumsprofil konnte nicht geladen werden: ${error.message}`);
  }

  return data;
}

export async function fetchGrowthMeasurementsByParticipant(
  id: string,
): Promise<GrowthMeasurement[]> {
  const { data, error } = await supabase
    .from("growth_measurements")
    .select(GROWTH_MEASUREMENT_COLUMNS)
    .eq("participant_id", id)
    .order("measured_at", { ascending: false });

  if (error) {
    throw new Error(`Wachstumsmessungen konnten nicht geladen werden: ${error.message}`);
  }

  return data;
}

export async function fetchGrowthMeasurement(
  id: string,
  measurementId: string,
): Promise<GrowthMeasurement | null> {
  const { data, error } = await supabase
    .from("growth_measurements")
    .select(GROWTH_MEASUREMENT_COLUMNS)
    .eq("id", measurementId)
    .eq("participant_id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Wachstumsmessung konnte nicht geladen werden: ${error.message}`);
  }

  return data;
}
