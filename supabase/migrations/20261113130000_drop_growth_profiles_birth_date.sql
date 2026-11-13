-- Das Geburtsdatum liegt seit 20261113100000 beim Athleten (participants.birth_date).
-- Die App liest die Spalte im Wachstumsprofil nicht mehr.
alter table public.growth_profiles
    drop column if exists birth_date;
