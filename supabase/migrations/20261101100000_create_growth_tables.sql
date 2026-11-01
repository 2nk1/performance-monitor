-- Wachstums-Feature: eigenständige Tabellen, unabhängig von performance_tests.
-- Bestehende Tabellen werden NICHT verändert.

create type public.growth_sex as enum ('male', 'female');

-- Stammdaten für die Wachstumsprognose (max. ein Profil pro Person).
create table public.growth_profiles (
    participant_id uuid primary key
        references public.participants(id)
            on delete cascade,

    sex public.growth_sex not null,
    birth_date date not null,
    mother_height_cm numeric(4, 1),
    father_height_cm numeric(4, 1),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint growth_profiles_mother_height_check
        check (mother_height_cm is null or mother_height_cm between 100 and 230),
    constraint growth_profiles_father_height_check
        check (father_height_cm is null or father_height_cm between 100 and 230)
);

-- Anthropometrische Messungen mit eigenem Messdatum.
create table public.growth_measurements (
    id uuid primary key default gen_random_uuid(),
    participant_id uuid not null
        references public.participants(id)
            on delete cascade,

    measured_at date not null,
    height_cm numeric(4, 1) not null,
    weight_kg numeric(4, 1),
    sitting_height_cm numeric(4, 1),
    notes text,

    created_at timestamptz not null default now(),

    constraint growth_measurements_height_check
        check (height_cm between 50 and 250),
    constraint growth_measurements_weight_check
        check (weight_kg is null or weight_kg between 5 and 250),
    constraint growth_measurements_sitting_height_check
        check (
            sitting_height_cm is null
                or (sitting_height_cm > 0 and sitting_height_cm < height_cm)
            )
);

create index growth_measurements_participant_id_idx
    on public.growth_measurements(participant_id);

alter table public.growth_profiles enable row level security;
alter table public.growth_measurements enable row level security;

grant select, insert, update, delete on table public.growth_profiles to authenticated;
grant select, insert, update, delete on table public.growth_measurements to authenticated;

-- Gleiches Rechtemodell wie bei participants/performance_tests:
-- alle angemeldeten Nutzer:innen dürfen lesen und schreiben.
create policy "authenticated users can read growth profiles"
    on public.growth_profiles for select to authenticated using (true);
create policy "authenticated users can insert growth profiles"
    on public.growth_profiles for insert to authenticated with check (true);
create policy "authenticated users can update growth profiles"
    on public.growth_profiles for update to authenticated using (true) with check (true);
create policy "authenticated users can delete growth profiles"
    on public.growth_profiles for delete to authenticated using (true);

create policy "authenticated users can read growth measurements"
    on public.growth_measurements for select to authenticated using (true);
create policy "authenticated users can insert growth measurements"
    on public.growth_measurements for insert to authenticated with check (true);
create policy "authenticated users can update growth measurements"
    on public.growth_measurements for update to authenticated using (true) with check (true);
create policy "authenticated users can delete growth measurements"
    on public.growth_measurements for delete to authenticated using (true);
