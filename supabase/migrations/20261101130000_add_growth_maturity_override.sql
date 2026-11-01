-- Optionale manuelle Einstufung des Entwicklungstyps (überschreibt die Automatik).
create type public.growth_maturity as enum ('early', 'average', 'late');

alter table public.growth_profiles
    add column maturity_override public.growth_maturity;
