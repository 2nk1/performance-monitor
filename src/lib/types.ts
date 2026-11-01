import type { Database } from "@/lib/supabase/database.types";

export type Participant = Database["public"]["Tables"]["participants"]["Row"];
export type PerformanceTest = Database["public"]["Tables"]["performance_tests"]["Row"];
export type GrowthProfile = Database["public"]["Tables"]["growth_profiles"]["Row"];
export type GrowthMeasurement = Database["public"]["Tables"]["growth_measurements"]["Row"];
export type GrowthSex = Database["public"]["Enums"]["growth_sex"];

export type ComparisonMetric =
  | "reach_height"
  | "jump_reach"
  | "jump_height"
  | "sprint_93639"
  | "ball_control";

export type DevelopmentMetric = Extract<
  ComparisonMetric,
  "reach_height" | "jump_reach" | "jump_height" | "sprint_93639" | "ball_control"
>;

export type ComparisonTest = Omit<PerformanceTest, "participant_id" | "notes" | "created_at"> & {
  participant: Pick<Participant, "id" | "name" | "birth_year" | "participant_type" | "active">;
};
