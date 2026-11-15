import * as SQLite from 'expo-sqlite';
import { PLANT_SPECIES_BY_ID } from '../data/nzPlantCatalog';
import {
  CanvasGeometry,
  CareTask,
  DiagnosisEvent,
  GardenObstacle,
  GardenProfile,
  GardenZone,
  HarvestLog,
  Planting,
  RotationHistoryEntry,
  SyncQueueItem
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
      'ALTER TABLE garden_profiles ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1;',
      'ALTER TABLE garden_profiles ADD COLUMN ai_scans_used_this_month INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE garden_profiles ADD COLUMN ai_scans_month_key TEXT;',
      'ALTER TABLE garden_profiles ADD COLUMN ai_bonus_credits INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE garden_profiles ADD COLUMN cloud_user_id TEXT;',
      'ALTER TABLE garden_profiles ADD COLUMN last_synced_at_iso TEXT;',
      'ALTER TABLE garden_zones ADD COLUMN canvas_geometry_json TEXT;'
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

async function enqueueSyncMutation(
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  operation: SyncQueueItem['operation'],
  payload: unknown
): Promise<void> {
  const db = await getDb();
  const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await db.runAsync(
    `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload_json, created_at_iso)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entityType, entityId, operation, JSON.stringify(payload), new Date().toISOString()]
  );
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
    ai_scans_used_this_month: number | null;
    ai_scans_month_key: string | null;
    ai_bonus_credits: number | null;
    cloud_user_id: string | null;
    last_synced_at_iso: string | null;
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
    notificationsEnabled: row.notifications_enabled !== 0,
    aiScansUsedThisMonth: row.ai_scans_used_this_month ?? 0,
    aiScansMonthKey: row.ai_scans_month_key ?? undefined,
    aiBonusCredits: row.ai_bonus_credits ?? 0,
    cloudUserId: row.cloud_user_id ?? undefined,
    lastSyncedAtIso: row.last_synced_at_iso ?? undefined
  };
}

export async function saveGardenProfile(profile: GardenProfile): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO garden_profiles (
      id, postcode, suburb, city, latitude, longitude, street_number,
      climate_zone_id, council_id, maramataka_enabled, is_pro, created_at_iso,
      restriction_stage_override, notifications_enabled,
      ai_scans_used_this_month, ai_scans_month_key, ai_bonus_credits,
      cloud_user_id, last_synced_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      profile.notificationsEnabled === false ? 0 : 1,
      profile.aiScansUsedThisMonth ?? 0,
      profile.aiScansMonthKey ?? null,
      profile.aiBonusCredits ?? 0,
      profile.cloudUserId ?? null,
      profile.lastSyncedAtIso ?? null
    ]
  );
  await enqueueSyncMutation('profile', profile.id, 'UPSERT', profile);
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
    canvas_geometry_json: string | null;
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
    rainwaterTankConnected: r.rainwater_tank_connected === 1,
    canvasGeometry: r.canvas_geometry_json
      ? (JSON.parse(r.canvas_geometry_json) as CanvasGeometry)
      : undefined
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
      sun_aspect, soil_type, drainage, rainwater_tank_connected, canvas_geometry_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      zone.rainwaterTankConnected ? 1 : 0,
      zone.canvasGeometry ? JSON.stringify(zone.canvasGeometry) : null
    ]
  );
  await enqueueSyncMutation('zone', zone.id, 'UPSERT', zone);
  return { ok: true };
}

export async function updateZoneCanvasGeometry(
  zoneId: string,
  geometry: CanvasGeometry
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE garden_zones SET canvas_geometry_json = ? WHERE id = ?',
    [JSON.stringify(geometry), zoneId]
  );
  await enqueueSyncMutation('zone', zoneId, 'UPSERT', { id: zoneId, canvasGeometry: geometry });
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

  // Record in multi-season crop-rotation history
  const species = PLANT_SPECIES_BY_ID[planting.speciesId];
  if (species) {
    const seasonYear = Number(planting.plantedDateIso.slice(0, 4)) || new Date().getFullYear();
    await db.runAsync(
      `INSERT OR REPLACE INTO planting_history (
        id, zone_id, species_id, rotation_family, season_year, planted_date_iso
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `hist_${planting.id}`,
        planting.zoneId,
        planting.speciesId,
        species.rotationFamily,
        seasonYear,
        planting.plantedDateIso
      ]
    );
  }
  await enqueueSyncMutation('planting', planting.id, 'UPSERT', planting);
}

export async function listRotationHistoryForZone(zoneId: string): Promise<RotationHistoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    zone_id: string;
    species_id: string;
    rotation_family: string;
    season_year: number;
    planted_date_iso: string;
  }>('SELECT * FROM planting_history WHERE zone_id = ? ORDER BY season_year DESC', [zoneId]);

  return rows.map((r) => ({
    zoneId: r.zone_id,
    speciesId: r.species_id,
    rotationFamily: r.rotation_family,
    seasonYear: r.season_year,
    plantedDateIso: r.planted_date_iso
  }));
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
  await enqueueSyncMutation('zone', zoneId, 'DELETE', { id: zoneId });
}

export async function removePlanting(plantingId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM plantings WHERE id = ?', [plantingId]);
  await enqueueSyncMutation('planting', plantingId, 'DELETE', { id: plantingId });
}

/* -------------------------------------------------------------------------- */
/*                    Phase 2/3: Obstacles, AI & Harvests                     */
/* -------------------------------------------------------------------------- */

export async function listObstaclesForProfile(profileId: string): Promise<GardenObstacle[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    profile_id: string;
    name: string;
    obstacle_type: GardenObstacle['obstacleType'];
    x_cm: number;
    y_cm: number;
    width_cm: number;
    length_cm: number;
    height_cm: number;
  }>('SELECT * FROM garden_obstacles WHERE profile_id = ?', [profileId]);

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    name: r.name,
    obstacleType: r.obstacle_type,
    xCm: r.x_cm,
    yCm: r.y_cm,
    widthCm: r.width_cm,
    lengthCm: r.length_cm,
    heightCm: r.height_cm
  }));
}

export async function upsertObstacle(obstacle: GardenObstacle): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO garden_obstacles (
      id, profile_id, name, obstacle_type, x_cm, y_cm, width_cm, length_cm, height_cm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      obstacle.id,
      obstacle.profileId,
      obstacle.name,
      obstacle.obstacleType,
      obstacle.xCm,
      obstacle.yCm,
      obstacle.widthCm,
      obstacle.lengthCm,
      obstacle.heightCm
    ]
  );
  await enqueueSyncMutation('obstacle', obstacle.id, 'UPSERT', obstacle);
}

export async function deleteObstacle(obstacleId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM garden_obstacles WHERE id = ?', [obstacleId]);
  await enqueueSyncMutation('obstacle', obstacleId, 'DELETE', { id: obstacleId });
}

export async function listDiagnosisEvents(profileId: string): Promise<DiagnosisEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    profile_id: string;
    zone_id: string | null;
    created_at_iso: string;
    query_notes: string;
    top_diagnosis: string;
    confidence: number;
    is_nppa_weed: number;
    nppa_guidance: string | null;
    treatment_steps_json: string;
    source: DiagnosisEvent['source'];
  }>('SELECT * FROM diagnosis_events WHERE profile_id = ? ORDER BY created_at_iso DESC', [profileId]);

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    zoneId: r.zone_id ?? undefined,
    createdAtIso: r.created_at_iso,
    queryNotes: r.query_notes,
    topDiagnosis: r.top_diagnosis,
    confidence: r.confidence,
    isNppaWeed: r.is_nppa_weed === 1,
    nppaGuidance: r.nppa_guidance ?? undefined,
    treatmentSteps: JSON.parse(r.treatment_steps_json) as string[],
    source: r.source
  }));
}

export async function saveDiagnosisEvent(event: DiagnosisEvent): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO diagnosis_events (
      id, profile_id, zone_id, created_at_iso, query_notes, top_diagnosis,
      confidence, is_nppa_weed, nppa_guidance, treatment_steps_json, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.profileId,
      event.zoneId ?? null,
      event.createdAtIso,
      event.queryNotes,
      event.topDiagnosis,
      event.confidence,
      event.isNppaWeed ? 1 : 0,
      event.nppaGuidance ?? null,
      JSON.stringify(event.treatmentSteps),
      event.source
    ]
  );
  await enqueueSyncMutation('diagnosis', event.id, 'UPSERT', event);
}

export async function listHarvestLogs(profileId: string): Promise<HarvestLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    profile_id: string;
    zone_id: string;
    species_id: string;
    harvested_at_iso: string;
    quantity_label: string;
    weight_grams: number | null;
    notes: string | null;
  }>('SELECT * FROM harvest_logs WHERE profile_id = ? ORDER BY harvested_at_iso DESC', [profileId]);

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    zoneId: r.zone_id,
    speciesId: r.species_id,
    harvestedAtIso: r.harvested_at_iso,
    quantityLabel: r.quantity_label,
    weightGrams: r.weight_grams ?? undefined,
    notes: r.notes ?? undefined
  }));
}

export async function saveHarvestLog(log: HarvestLog): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO harvest_logs (
      id, profile_id, zone_id, species_id, harvested_at_iso, quantity_label, weight_grams, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.profileId,
      log.zoneId,
      log.speciesId,
      log.harvestedAtIso,
      log.quantityLabel,
      log.weightGrams ?? null,
      log.notes ?? null
    ]
  );
  await enqueueSyncMutation('harvest', log.id, 'UPSERT', log);
}

export async function listPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    entity_type: SyncQueueItem['entityType'];
    entity_id: string;
    operation: SyncQueueItem['operation'];
    payload_json: string;
    created_at_iso: string;
    synced_at_iso: string | null;
  }>('SELECT * FROM sync_queue WHERE synced_at_iso IS NULL ORDER BY created_at_iso ASC');

  return rows.map((r) => ({
    id: r.id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    operation: r.operation,
    payloadJson: r.payload_json,
    createdAtIso: r.created_at_iso,
    syncedAtIso: r.synced_at_iso ?? undefined
  }));
}

export async function markSyncItemsCompleted(ids: string[], syncedAtIso: string): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE sync_queue SET synced_at_iso = ? WHERE id IN (${placeholders})`,
    [syncedAtIso, ...ids]
  );
}
