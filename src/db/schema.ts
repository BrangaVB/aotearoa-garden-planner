export const DB_NAME = 'aotearoa_garden_planner.db';

export const CREATE_TABLES_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS garden_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  postcode TEXT NOT NULL,
  suburb TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  street_number INTEGER,
  climate_zone_id TEXT NOT NULL,
  council_id TEXT NOT NULL,
  maramataka_enabled INTEGER NOT NULL DEFAULT 0,
  is_pro INTEGER NOT NULL DEFAULT 0,
  created_at_iso TEXT NOT NULL,
  restriction_stage_override INTEGER,
  notifications_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS garden_zones (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  width_cm REAL NOT NULL,
  length_cm REAL NOT NULL,
  sun_aspect TEXT NOT NULL,
  soil_type TEXT NOT NULL,
  drainage TEXT NOT NULL,
  rainwater_tank_connected INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (profile_id) REFERENCES garden_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plantings (
  id TEXT PRIMARY KEY NOT NULL,
  zone_id TEXT NOT NULL,
  species_id TEXT NOT NULL,
  planted_date_iso TEXT NOT NULL,
  growth_stage TEXT NOT NULL,
  grid_row INTEGER NOT NULL,
  grid_col INTEGER NOT NULL,
  moisture_deficit_mm REAL NOT NULL DEFAULT 0,
  last_watered_iso TEXT,
  FOREIGN KEY (zone_id) REFERENCES garden_zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watering_logs (
  id TEXT PRIMARY KEY NOT NULL,
  zone_id TEXT NOT NULL,
  watered_at_iso TEXT NOT NULL,
  litres_applied REAL NOT NULL,
  method TEXT NOT NULL,
  FOREIGN KEY (zone_id) REFERENCES garden_zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS care_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  zone_id TEXT,
  planting_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  due_date_iso TEXT NOT NULL,
  priority TEXT NOT NULL,
  description TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0
);
`;
