-- Das Geburtsdatum liegt künftig beim Athleten statt im Wachstumsprofil, damit es
-- nur einmal erfasst wird. Der Jahrgang wird daraus abgeleitet.
--
-- WICHTIG: Diese Migration muss laufen, BEVOR die dazugehörige App-Version live geht.
-- Die neue App liest participants.birth_date und kennt growth_profiles.birth_date nicht mehr.

alter table public.participants
    add column birth_date date;

alter table public.participants
    add constraint participants_birth_date_check
        check (birth_date is null or birth_date between date '1900-01-01' and date '2100-12-31');

-- Bestehende Geburtsdaten aus den Wachstumsprofilen übernehmen. Weicht der Jahrgang
-- vom Profil-Datum ab, gilt das Datum.
update public.participants p
set birth_date = gp.birth_date
from public.growth_profiles gp
where gp.participant_id = p.id;

-- Jahrgang aus dem Geburtsdatum ableiten, sobald eines gesetzt ist. Ohne Datum
-- bleibt der Jahrgang frei eintragbar (z. B. bei Referenzpersonen).
create function public.participants_sync_birth_year()
    returns trigger
    language plpgsql
    set search_path = public
as
$$
begin
    if new.birth_date is not null then
        new.birth_year := extract(year from new.birth_date)::smallint;
    end if;

    return new;
end;
$$;

create trigger participants_sync_birth_year
    before insert or update of birth_date, birth_year
    on public.participants
    for each row
execute function public.participants_sync_birth_year();

-- Vorhandene Jahrgänge an die übernommenen Daten angleichen (löst den Trigger aus).
update public.participants
set birth_date = birth_date
where birth_date is not null;

alter table public.growth_profiles
    drop column birth_date;
