-- Aotearoa Garden Planner — Supabase Postgres + PostGIS Initial Schema (Phase 2 & 3)

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

create table if not exists public.climate_zones (
  id text primary key,
  name text not null,
  region text not null,
  mean_last_spring_frost text not null,
  spring_frost_p90 text not null,
  mean_first_autumn_frost text not null,
  annual_rainfall_mm integer not null,
  annual_sunshine_hours integer,
  wind_exposure text not null,
  notes text not null
);

create table if not exists public.council_water_rules (
  id text primary key,
  authority_name text not null,
  authority_type text,
  region text,
  water_provider text,
  territories text[] not null default '{}',
  stage smallint not null default 0 check (stage between 0 and 4),
  stage_label text not null,
  sprinklers_allowed boolean not null default true,
  irrigation_system_allowed boolean not null default true,
  hand_held_hose_allowed boolean not null default true,
  watering_can_allowed boolean not null default true,
  odd_even_rule boolean not null default false,
  allowed_hours_label text not null,
  summary text not null,
  last_updated_iso date not null default current_date
);

create table if not exists public.garden_profiles (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  postcode text not null,
  suburb text not null,
  city text not null,
  location geography(Point, 4326),
  street_number integer,
  climate_zone_id text not null references public.climate_zones(id),
  council_id text not null references public.council_water_rules(id),
  maramataka_enabled boolean not null default false,
  is_pro boolean not null default false,
  restriction_stage_override smallint check (restriction_stage_override between 0 and 4),
  ai_scans_used_this_month integer not null default 0,
  ai_scans_month_key text,
  ai_bonus_credits integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.garden_zones (
  id text primary key,
  profile_id text not null references public.garden_profiles(id) on delete cascade,
  name text not null,
  zone_type text not null,
  width_cm real not null,
  length_cm real not null,
  sun_aspect text not null,
  soil_type text not null,
  drainage text not null,
  rainwater_tank_connected boolean not null default false,
  canvas_geometry jsonb
);

create table if not exists public.garden_obstacles (
  id text primary key,
  profile_id text not null references public.garden_profiles(id) on delete cascade,
  name text not null,
  obstacle_type text not null,
  x_cm real not null,
  y_cm real not null,
  width_cm real not null,
  length_cm real not null,
  height_cm real not null
);

create table if not exists public.plantings (
  id text primary key,
  zone_id text not null references public.garden_zones(id) on delete cascade,
  species_id text not null,
  planted_date_iso date not null,
  growth_stage text not null,
  grid_row integer not null,
  grid_col integer not null,
  moisture_deficit_mm real not null default 0,
  last_watered_iso timestamptz
);

create table if not exists public.harvest_logs (
  id text primary key,
  profile_id text not null references public.garden_profiles(id) on delete cascade,
  zone_id text not null references public.garden_zones(id) on delete cascade,
  species_id text not null,
  harvested_at_iso date not null,
  quantity_label text not null,
  weight_grams real,
  notes text
);

create table if not exists public.diagnosis_events (
  id text primary key,
  profile_id text not null references public.garden_profiles(id) on delete cascade,
  zone_id text references public.garden_zones(id) on delete set null,
  created_at_iso timestamptz not null default now(),
  query_notes text not null,
  top_diagnosis text not null,
  confidence real not null,
  is_nppa_weed boolean not null default false,
  nppa_guidance text,
  treatment_steps jsonb not null default '[]'::jsonb,
  source text not null
);

-- Row-Level Security
alter table public.garden_profiles enable row level security;
alter table public.garden_zones enable row level security;
alter table public.garden_obstacles enable row level security;
alter table public.plantings enable row level security;
alter table public.harvest_logs enable row level security;
alter table public.diagnosis_events enable row level security;

create policy "Users manage own profiles" on public.garden_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own zones" on public.garden_zones
  for all using (
    exists (
      select 1 from public.garden_profiles p
      where p.id = garden_zones.profile_id and p.user_id = auth.uid()
    )
  );

create policy "Users manage own obstacles" on public.garden_obstacles
  for all using (
    exists (
      select 1 from public.garden_profiles p
      where p.id = garden_obstacles.profile_id and p.user_id = auth.uid()
    )
  );

create policy "Users manage own plantings" on public.plantings
  for all using (
    exists (
      select 1 from public.garden_zones z
      join public.garden_profiles p on p.id = z.profile_id
      where z.id = plantings.zone_id and p.user_id = auth.uid()
    )
  );

create policy "Users manage own harvests" on public.harvest_logs
  for all using (
    exists (
      select 1 from public.garden_profiles p
      where p.id = harvest_logs.profile_id and p.user_id = auth.uid()
    )
  );

create policy "Users manage own diagnoses" on public.diagnosis_events
  for all using (
    exists (
      select 1 from public.garden_profiles p
      where p.id = diagnosis_events.profile_id and p.user_id = auth.uid()
    )
  );
