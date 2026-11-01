-- Armspannweite (optional) je Wachstumsmessung.
alter table public.growth_measurements
    add column arm_span_cm numeric(4, 1);

alter table public.growth_measurements
    add constraint growth_measurements_arm_span_check
        check (arm_span_cm is null or arm_span_cm between 30 and 250);
