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
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  ai_scans_used_this_month INTEGER NOT NULL DEFAULT 0,
  ai_scans_month_key TEXT,
  ai_bonus_credits INTEGER NOT NULL DEFAULT 0,
  cloud_user_id TEXT,
  last_synced_at_iso TEXT
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
  canvas_geometry_json TEXT,
  FOREIGN KEY (profile_id) REFERENCES garden_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS garden_obstacles (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  obstacle_type TEXT NOT NULL,
  x_cm REAL NOT NULL,
  y_cm REAL NOT NULL,
  width_cm REAL NOT NULL,
  length_cm REAL NOT NULL,
  height_cm REAL NOT NULL,
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

CREATE TABLE IF NOT EXISTS planting_history (
  id TEXT PRIMARY KEY NOT NULL,
  zone_id TEXT NOT NULL,
  species_id TEXT NOT NULL,
  rotation_family TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  planted_date_iso TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS diagnosis_events (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  zone_id TEXT,
  created_at_iso TEXT NOT NULL,
  query_notes TEXT NOT NULL,
  top_diagnosis TEXT NOT NULL,
  confidence REAL NOT NULL,
  is_nppa_weed INTEGER NOT NULL DEFAULT 0,
  nppa_guidance TEXT,
  treatment_steps_json TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS harvest_logs (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  species_id TEXT NOT NULL,
  harvested_at_iso TEXT NOT NULL,
  quantity_label TEXT NOT NULL,
  weight_grams REAL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at_iso TEXT NOT NULL,
  synced_at_iso TEXT
);
`;
