-- Neugeborene (ca. 2-6 kg, 45-55 cm) müssen erfassbar sein, z. B. aus dem U-Heft.
alter table public.growth_measurements
    drop constraint growth_measurements_height_check,
    drop constraint growth_measurements_weight_check;

alter table public.growth_measurements
    add constraint growth_measurements_height_check
        check (height_cm between 30 and 250),
    add constraint growth_measurements_weight_check
        check (weight_kg is null or weight_kg between 0.5 and 250);
