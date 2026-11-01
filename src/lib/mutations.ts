import { supabase } from "@/lib/supabase/client";
import type {
  GrowthMeasurementFormValues,
  GrowthProfileFormValues,
  PerformanceTestFormValues,
} from "@/lib/forms";

export async function createParticipant(input: {
  name: string;
  birthYear: number | null;
  participantType: "athlete" | "reference";
}) {
  const { error } = await supabase.from("participants").insert({
    name: input.name,
    birth_year: input.birthYear,
    participant_type: input.participantType,
  });

  if (error) {
    throw new Error(`Athlet:in konnte nicht gespeichert werden: ${error.message}`);
  }
}

export async function updateParticipant(
  participantId: string,
  input: {
    name: string;
    birthYear: number | null;
    participantType: "athlete" | "reference";
    active: boolean;
  },
) {
  const { error } = await supabase
    .from("participants")
    .update({
      name: input.name,
      birth_year: input.birthYear,
      participant_type: input.participantType,
      active: input.active,
    })
    .eq("id", participantId);

  if (error) {
    throw new Error(`Athlet:in konnte nicht geändert werden: ${error.message}`);
  }
}

export async function createPerformanceTest(
  participantId: string,
  input: {
    testDate: string;
    ageGroup: string | null;
    reachHeight: number | null;
    jumpReach: number | null;
    sprint: number | null;
    ballControl: number | null;
  },
) {
  const { error } = await supabase.from("performance_tests").insert({
    participant_id: participantId,
    test_date: input.testDate,
    age_group: input.ageGroup,
    reach_height_cm: input.reachHeight,
    jump_reach_cm: input.jumpReach,
    sprint_93639_seconds: input.sprint,
    ball_control_count: input.ballControl,
  });

  if (error) {
    throw new Error(`Leistungstest konnte nicht gespeichert werden: ${error.message}`);
  }
}

export async function updatePerformanceTest(
  participantId: string,
  testId: string,
  input: PerformanceTestFormValues,
) {
  const { error } = await supabase
    .from("performance_tests")
    .update({
      test_date: input.testDate,
      age_group: input.ageGroup,
      reach_height_cm: input.reachHeight,
      jump_reach_cm: input.jumpReach,
      sprint_93639_seconds: input.sprint,
      ball_control_count: input.ballControl,
    })
    .eq("id", testId)
    .eq("participant_id", participantId);

  if (error) {
    throw new Error(`Leistungstest konnte nicht geändert werden: ${error.message}`);
  }
}

export async function deletePerformanceTest(participantId: string, testId: string) {
  const { error } = await supabase
    .from("performance_tests")
    .delete()
    .eq("id", testId)
    .eq("participant_id", participantId);

  if (error) {
    throw new Error(`Leistungstest konnte nicht gelöscht werden: ${error.message}`);
  }
}

export async function saveGrowthProfile(participantId: string, input: GrowthProfileFormValues) {
  const { error } = await supabase.from("growth_profiles").upsert({
    participant_id: participantId,
    sex: input.sex,
    birth_date: input.birthDate,
    mother_height_cm: input.motherHeight,
    father_height_cm: input.fatherHeight,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Wachstumsprofil konnte nicht gespeichert werden: ${error.message}`);
  }
}

export async function createGrowthMeasurement(
  participantId: string,
  input: GrowthMeasurementFormValues,
) {
  const { error } = await supabase.from("growth_measurements").insert({
    participant_id: participantId,
    measured_at: input.measuredAt,
    height_cm: input.height,
    weight_kg: input.weight,
    sitting_height_cm: input.sittingHeight,
    notes: input.notes,
  });

  if (error) {
    throw new Error(`Wachstumsmessung konnte nicht gespeichert werden: ${error.message}`);
  }
}

export async function updateGrowthMeasurement(
  participantId: string,
  measurementId: string,
  input: GrowthMeasurementFormValues,
) {
  const { error } = await supabase
    .from("growth_measurements")
    .update({
      measured_at: input.measuredAt,
      height_cm: input.height,
      weight_kg: input.weight,
      sitting_height_cm: input.sittingHeight,
      notes: input.notes,
    })
    .eq("id", measurementId)
    .eq("participant_id", participantId);

  if (error) {
    throw new Error(`Wachstumsmessung konnte nicht geändert werden: ${error.message}`);
  }
}

export async function deleteGrowthMeasurement(participantId: string, measurementId: string) {
  const { error } = await supabase
    .from("growth_measurements")
    .delete()
    .eq("id", measurementId)
    .eq("participant_id", participantId);

  if (error) {
    throw new Error(`Wachstumsmessung konnte nicht gelöscht werden: ${error.message}`);
  }
}
