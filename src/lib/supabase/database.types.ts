export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Hier von Hand gepflegter Ersatz für die per `supabase gen types` erzeugte
 * Datei (kein lokales Supabase in dieser Umgebung verfügbar). WICHTIG:
 * `@supabase/supabase-js` (>=2.x, `postgrest-js`) verlangt für jede Tabelle
 * zwingend ein `Relationships`-Feld (siehe `GenericTable` in
 * `postgrest-js/src/types/common/common.ts`). Fehlt es, erfüllt
 * `Database["public"]` nicht mehr `GenericSchema` – `SupabaseClient` fällt
 * dann intern komplett auf `never` zurück (siehe generische Constraints in
 * `SupabaseClient.ts`), was genau die "Property X does not exist on type
 * never"-Fehler in `data.ts`/`mutations.ts` verursacht. Ohne modellierte
 * Fremdschlüssel-Beziehungen ist `Relationships: []` (leeres Array) korrekt.
 */
export type Database = {
  public: {
    Enums: {
      participant_type: "athlete" | "reference";
      growth_sex: "male" | "female";
      growth_maturity: "early" | "average" | "late";
    };
    Tables: {
      participants: {
        Row: {
          id: string;
          name: string;
          birth_year: number | null;
          participant_type: Database["public"]["Enums"]["participant_type"];
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          birth_year?: number | null;
          participant_type?: Database["public"]["Enums"]["participant_type"];
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          birth_year?: number | null;
          participant_type?: Database["public"]["Enums"]["participant_type"];
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      performance_tests: {
        Row: {
          id: string;
          participant_id: string;
          test_date: string;
          age_group: string | null;
          reach_height_cm: number | null;
          jump_reach_cm: number | null;
          sprint_93639_seconds: number | null;
          ball_control_count: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          test_date: string;
          age_group?: string | null;
          reach_height_cm?: number | null;
          jump_reach_cm?: number | null;
          sprint_93639_seconds?: number | null;
          ball_control_count?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          test_date?: string;
          age_group?: string | null;
          reach_height_cm?: number | null;
          jump_reach_cm?: number | null;
          sprint_93639_seconds?: number | null;
          ball_control_count?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      growth_profiles: {
        Row: {
          participant_id: string;
          sex: Database["public"]["Enums"]["growth_sex"];
          birth_date: string;
          mother_height_cm: number | null;
          father_height_cm: number | null;
          maturity_override: Database["public"]["Enums"]["growth_maturity"] | null;
          maturity_delay_years: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          participant_id: string;
          sex: Database["public"]["Enums"]["growth_sex"];
          birth_date: string;
          mother_height_cm?: number | null;
          father_height_cm?: number | null;
          maturity_override?: Database["public"]["Enums"]["growth_maturity"] | null;
          maturity_delay_years?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          participant_id?: string;
          sex?: Database["public"]["Enums"]["growth_sex"];
          birth_date?: string;
          mother_height_cm?: number | null;
          father_height_cm?: number | null;
          maturity_override?: Database["public"]["Enums"]["growth_maturity"] | null;
          maturity_delay_years?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      growth_measurements: {
        Row: {
          id: string;
          participant_id: string;
          measured_at: string;
          height_cm: number;
          weight_kg: number | null;
          sitting_height_cm: number | null;
          arm_span_cm: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          measured_at: string;
          height_cm: number;
          weight_kg?: number | null;
          sitting_height_cm?: number | null;
          arm_span_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          measured_at?: string;
          height_cm?: number;
          weight_kg?: number | null;
          sitting_height_cm?: number | null;
          arm_span_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
