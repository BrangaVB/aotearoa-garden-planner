import * as SQLite from 'expo-sqlite';
import {
  CareTask,
  GardenProfile,
  GardenZone,
  Planting
} from '../types/domain';
import { CREATE_TABLES_SQL, DB_NAME } from './schema';

export const FREE_TIER_MAX_ZONES = 3;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await dbInstance.execAsync(CREATE_TABLES_SQL);
    // Safe idempotent migrations for existing local SQLite databases
    for (const stmt of [
      'ALTER TABLE garden_profiles ADD COLUMN restriction_stage_override INTEGER;',
      'ALTER TABLE garden_profiles ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1;'
    ]) {
      try {
        await dbInstance.execAsync(stmt);
      } catch {
        // Column already exists
      }
    }
  }
  return dbInstance;
}

export async function getActiveProfile(): Promise<GardenProfile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    postcode: string;
    suburb: string;
    city: string;
    latitude: number;
    longitude: number;
    street_number: number | null;
    climate_zone_id: string;
    council_id: string;
    maramataka_enabled: number;
    is_pro: number;
    created_at_iso: string;
    restriction_stage_override: number | null;
    notifications_enabled: number | null;
  }>('SELECT * FROM garden_profiles LIMIT 1');

  if (!row) return null;
  return {
    id: row.id,
    postcode: row.postcode,
    suburb: row.suburb,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    streetNumber: row.street_number ?? undefined,
    climateZoneId: row.climate_zone_id,
    councilId: row.council_id,
    maramatakaEnabled: row.maramataka_enabled === 1,
    isPro: row.is_pro === 1,
    createdAtIso: row.created_at_iso,
    restrictionStageOverride:
      row.restriction_stage_override !== null && row.restriction_stage_override !== undefined
        ? (row.restriction_stage_override as GardenProfile['restrictionStageOverride'])
        : undefined,
    notificationsEnabled: row.notifications_enabled !== 0
  };
}

export async function saveGardenProfile(profile: GardenProfile): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO garden_profiles (
      id, postcode, suburb, city, latitude, longitude, street_number,
      climate_zone_id, council_id, maramataka_enabled, is_pro, created_at_iso,
      restriction_stage_override, notifications_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.postcode,
      profile.suburb,
      profile.city,
      profile.latitude,
      profile.longitude,
      profile.streetNumber ?? null,
      profile.climateZoneId,
      profile.councilId,
      profile.maramatakaEnabled ? 1 : 0,
      profile.isPro ? 1 : 0,
      profile.createdAtIso,
      profile.restrictionStageOverride ?? null,
      profile.notificationsEnabled === false ? 0 : 1
    ]
  );
}

export async function listZonesForProfile(profileId: string): Promise<GardenZone[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    profile_id: string;
    name: string;
    zone_type: GardenZone['zoneType'];
    width_cm: number;
    length_cm: number;
    sun_aspect: GardenZone['sunAspect'];
    soil_type: GardenZone['soilType'];
    drainage: GardenZone['drainage'];
    rainwater_tank_connected: number;
  }>('SELECT * FROM garden_zones WHERE profile_id = ?', [profileId]);

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    name: r.name,
    zoneType: r.zone_type,
    widthCm: r.width_cm,
    lengthCm: r.length_cm,
    sunAspect: r.sun_aspect,
    soilType: r.soil_type,
    drainage: r.drainage,
    rainwaterTankConnected: r.rainwater_tank_connected === 1
  }));
}

export async function createGardenZone(
  profile: GardenProfile,
  zone: GardenZone
): Promise<{ ok: true } | { ok: false; reason: 'FREE_LIMIT_REACHED' }> {
  const existing = await listZonesForProfile(profile.id);
  if (!profile.isPro && existing.length >= FREE_TIER_MAX_ZONES) {
    return { ok: false, reason: 'FREE_LIMIT_REACHED' };
  }

  const db = await getDb();
  await db.runAsync(
    `INSERT INTO garden_zones (
      id, profile_id, name, zone_type, width_cm, length_cm,
      sun_aspect, soil_type, drainage, rainwater_tank_connected
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      zone.id,
      zone.profileId,
      zone.name,
      zone.zoneType,
      zone.widthCm,
      zone.lengthCm,
      zone.sunAspect,
      zone.soilType,
      zone.drainage,
      zone.rainwaterTankConnected ? 1 : 0
    ]
  );
  return { ok: true };
}

export async function listPlantingsForZone(zoneId: string): Promise<Planting[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    zone_id: string;
    species_id: string;
    planted_date_iso: string;
    growth_stage: Planting['growthStage'];
    grid_row: number;
    grid_col: number;
    moisture_deficit_mm: number;
    last_watered_iso: string | null;
  }>('SELECT * FROM plantings WHERE zone_id = ?', [zoneId]);

  return rows.map((r) => ({
    id: r.id,
    zoneId: r.zone_id,
    speciesId: r.species_id,
    plantedDateIso: r.planted_date_iso,
    growthStage: r.growth_stage,
    gridRow: r.grid_row,
    gridCol: r.grid_col,
    moistureDeficitMm: r.moisture_deficit_mm,
    lastWateredIso: r.last_watered_iso ?? undefined
  }));
}

export async function upsertPlanting(planting: Planting): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO plantings (
      id, zone_id, species_id, planted_date_iso, growth_stage,
      grid_row, grid_col, moisture_deficit_mm, last_watered_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planting.id,
      planting.zoneId,
      planting.speciesId,
      planting.plantedDateIso,
      planting.growthStage,
      planting.gridRow,
      planting.gridCol,
      planting.moistureDeficitMm,
      planting.lastWateredIso ?? null
    ]
  );
}

export async function recordZoneWatering(
  zoneId: string,
  litresApplied: number,
  method: string,
  wateredAtIso: string
): Promise<void> {
  const db = await getDb();
  const logId = `wlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await db.runAsync(
    'INSERT INTO watering_logs (id, zone_id, watered_at_iso, litres_applied, method) VALUES (?, ?, ?, ?, ?)',
    [logId, zoneId, wateredAtIso, litresApplied, method]
  );
  await db.runAsync(
    'UPDATE plantings SET moisture_deficit_mm = 0, last_watered_iso = ? WHERE zone_id = ?',
    [wateredAtIso, zoneId]
  );
}

export async function listCareTasks(): Promise<CareTask[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    zone_id: string | null;
    planting_id: string | null;
    title: string;
    category: CareTask['category'];
    due_date_iso: string;
    priority: CareTask['priority'];
    description: string;
    completed: number;
  }>('SELECT * FROM care_tasks ORDER BY completed ASC, due_date_iso ASC');

  return rows.map((r) => ({
    id: r.id,
    zoneId: r.zone_id ?? undefined,
    plantingId: r.planting_id ?? undefined,
    title: r.title,
    category: r.category,
    dueDateIso: r.due_date_iso,
    priority: r.priority,
    description: r.description,
    completed: r.completed === 1
  }));
}

export async function deleteGardenZone(zoneId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM garden_zones WHERE id = ?', [zoneId]);
}

export async function removePlanting(plantingId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM plantings WHERE id = ?', [plantingId]);
}
