-- Optionale Entwicklungsverzögerung in Jahren (negativ = früher dran als die Altersgenossen).
-- Wird für die Khamis-Roche-Zielgröße mit Entwicklungsalter verwendet.
alter table public.growth_profiles
    add column maturity_delay_years numeric(3, 1);

alter table public.growth_profiles
    add constraint growth_profiles_maturity_delay_check
        check (maturity_delay_years is null or maturity_delay_years between -4 and 6);
