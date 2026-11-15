export type SunRequirement = 'Full Sun' | 'Part Shade' | 'Full Shade';
export type SunAspect = 'North' | 'North-East' | 'North-West' | 'East' | 'West' | 'South';
export type SoilType = 'Clay' | 'Loam' | 'Sandy' | 'Volcanic/Pumice' | 'Potting Mix';
export type ZoneType = 'Raised Bed' | 'In-Ground Bed' | 'Patio Pots' | 'Orchard Strip' | 'Native Border';
export type PlantCategory = 'Vegetable' | 'Herb' | 'Fruit & Citrus' | 'NZ Native' | 'Ornamental' | 'NPPA Weed';
export type FrostTolerance = 'Tender' | 'Half-Hardy' | 'Hardy';
export type GrowthStage = 'Seedling' | 'Vegetative' | 'Flowering/Fruiting' | 'Established' | 'Dormant';
export type RestrictionStage = 0 | 1 | 2 | 3 | 4;

export interface ClimateZone {
  id: string;
  name: string;
  region: string;
  meanLastSpringFrost: string; // MM-DD (Southern Hemisphere: Aug-Nov)
  springFrostP90: string;      // Safe planting date (90th percentile)
  meanFirstAutumnFrost: string; // MM-DD (Southern Hemisphere: Apr-Jun)
  annualRainfallMm: number;
  annualSunshineHours?: number;
  windExposure: 'Low' | 'Moderate' | 'High' | 'High Coastal/Cook Strait';
  notes: string;
}

/**
 * Where a council rule came from. `curated` = manually checked against the council's
 * published rules on `lastUpdatedIso`; `baseline` = default Level 0 placeholder that the
 * user (or admin feed) should confirm; `user-reported` = the user overrode the stage in-app.
 */
export type CouncilRuleProvenance = 'curated' | 'baseline' | 'user-reported';

export interface CouncilWaterRule {
  id: string;
  authorityName: string;
  authorityType?: 'City Council' | 'District Council' | 'Unitary Authority' | 'Territorial Authority';
  region?: string;
  waterProvider?: string;
  territories: string[];
  stage: RestrictionStage;
  stageLabel: string;
  sprinklersAllowed: boolean;
  irrigationSystemAllowed: boolean;
  handHeldHoseAllowed: boolean;
  wateringCanAllowed: boolean;
  oddEvenRule: boolean;
  allowedHoursLabel: string;
  summary: string;
  lastUpdatedIso: string;
  provenance?: CouncilRuleProvenance;
}

export interface PostcodeLookupEntry {
  postcode: string;
  suburb: string;
  city: string;
  latitude: number;
  longitude: number;
  climateZoneId: string;
  councilId: string;
}

export interface GardenProfile {
  id: string;
  postcode: string;
  suburb: string;
  city: string;
  latitude: number;
  longitude: number;
  streetNumber?: number;
  climateZoneId: string;
  councilId: string;
  maramatakaEnabled: boolean;
  isPro: boolean;
  createdAtIso: string;
  /** User-reported restriction stage that overrides the bundled registry until cleared. */
  restrictionStageOverride?: RestrictionStage;
  notificationsEnabled?: boolean;
  /** Phase 2/3: AI diagnostics usage & bonus credit packs + optional cloud sync metadata. */
  aiScansUsedThisMonth?: number;
  aiScansMonthKey?: string; // YYYY-MM
  aiBonusCredits?: number;
  cloudUserId?: string;
  lastSyncedAtIso?: string;
}

export interface CanvasGeometry {
  xCm: number;
  yCm: number;
  rotationDeg?: number;
}

export interface GardenZone {
  id: string;
  profileId: string;
  name: string;
  zoneType: ZoneType;
  widthCm: number;
  lengthCm: number;
  sunAspect: SunAspect;
  soilType: SoilType;
  drainage: 'Poor' | 'Moderate' | 'Fast';
  rainwaterTankConnected: boolean;
  canvasGeometry?: CanvasGeometry;
}

export type ObstacleType = 'Fence' | 'Tree' | 'House Wall' | 'Shed';

export interface GardenObstacle {
  id: string;
  profileId: string;
  name: string;
  obstacleType: ObstacleType;
  xCm: number;
  yCm: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
}

export interface PlantSpecies {
  id: string;
  commonName: string;
  teReoName?: string;
  botanicalName: string;
  category: PlantCategory;
  sunRequirement: SunRequirement;
  kc: number; // Crop water coefficient (0.35 drought-tolerant native -> 1.15 high water edible)
  waterDemandLabel: 'Drought-Tolerant Native' | 'Low' | 'Moderate' | 'High';
  frostTolerance: FrostTolerance;
  coastalWindTolerant: boolean;
  spacingCm: number;
  matureHeightCm: number;
  matureSpreadCm: number;
  rotationFamily: string;
  companions: string[]; // species IDs
  antagonists: string[]; // species IDs
  sowMonths: number[];   // 1-12 (NZ Southern Hemisphere)
  plantMonths: number[]; // 1-12
  pruneMonths: number[]; // 1-12
  harvestMonths: number[]; // 1-12
  isNppaWeed: boolean;
  nppaDisposalAdvice?: string;
  careSummary: string;
}

export interface Planting {
  id: string;
  zoneId: string;
  speciesId: string;
  plantedDateIso: string;
  growthStage: GrowthStage;
  gridRow: number;
  gridCol: number;
  moistureDeficitMm: number;
  lastWateredIso?: string;
}

export interface DailyWeatherPoint {
  dateIso: string;
  rainfallMm: number;
  et0Mm: number;
  tempMinC: number;
  tempMaxC: number;
  windMaxKmh: number;
}

export interface WateringRecommendation {
  zoneId: string;
  zoneName: string;
  dateIso: string;
  action: 'WATER_NOW' | 'SKIP_RAIN' | 'DEFER_RESTRICTION_DAY' | 'HAND_WATER_ONLY' | 'BAN_EMERGENCY_ONLY';
  recommendedLitresPerSqm: number;
  totalZoneLitres: number;
  newDeficitMm: number;
  triggerThresholdMm: number;
  headline: string;
  reason: string;
  councilComplianceNote: string;
  rainwaterTip?: string;
}

export interface CareTask {
  id: string;
  zoneId?: string;
  plantingId?: string;
  title: string;
  category: 'Sowing' | 'Planting' | 'Pruning' | 'Feeding' | 'Frost Alert' | 'Biosecurity' | 'Maramataka';
  dueDateIso: string;
  priority: 'High' | 'Normal';
  description: string;
  completed: boolean;
}

export interface PestGuideEntry {
  id: string;
  name: string;
  teReoOrAltName?: string;
  type: 'Insect Pest' | 'Fungal/Oomycete Disease' | 'Mollusc';
  hostPlants: string[];
  peakMonthsNZ: number[];
  symptoms: string;
  organicRemedy: string;
  standardRemedy: string;
  preventionTip: string;
}

export interface DiagnosisEvent {
  id: string;
  profileId: string;
  zoneId?: string;
  createdAtIso: string;
  queryNotes: string;
  topDiagnosis: string;
  confidence: number;
  isNppaWeed: boolean;
  nppaGuidance?: string;
  treatmentSteps: string[];
  source: 'cloud-vision' | 'offline-matcher';
}

export interface HarvestLog {
  id: string;
  profileId: string;
  zoneId: string;
  speciesId: string;
  harvestedAtIso: string;
  quantityLabel: string;
  weightGrams?: number;
  notes?: string;
}

export interface RotationHistoryEntry {
  zoneId: string;
  speciesId: string;
  rotationFamily: string;
  seasonYear: number;
  plantedDateIso: string;
}

export interface SyncQueueItem {
  id: string;
  entityType: 'profile' | 'zone' | 'planting' | 'harvest' | 'diagnosis' | 'obstacle';
  entityId: string;
  operation: 'UPSERT' | 'DELETE';
  payloadJson: string;
  createdAtIso: string;
  syncedAtIso?: string;
}
