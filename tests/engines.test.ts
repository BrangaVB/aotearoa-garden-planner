import { describe, expect, it } from 'vitest';
import {
  getCouncilRule,
  lookupNzLocation,
  NZ_CLIMATE_ZONES,
  NZ_COUNCIL_WATER_RULES,
  NZ_POSTCODE_DIRECTORY,
  resolveEffectiveCouncilRule
} from '../src/data/nzClimateAndCouncils';
import { NZ_PEST_DISEASE_GUIDE } from '../src/data/nzPestGuide';
import {
  NZ_PLANT_CATALOG,
  PLANT_SPECIES_BY_ID,
  searchPlantCatalog
} from '../src/data/nzPlantCatalog';
import { computeArBedDimensions } from '../src/engine/arMeasurementEngine';
import { validatePlantingPlacement } from '../src/engine/bedPlannerEngine';
import { generateProactiveCareTasks } from '../src/engine/careCalendarEngine';
import { checkCropRotation } from '../src/engine/rotationEngine';
import {
  computeShadowProjection,
  computeSolarPosition,
  estimateZoneDailySun,
  SEASON_DAY_OF_YEAR
} from '../src/engine/sunPathEngine';
import { computeZoneWateringRecommendation } from '../src/engine/wateringEngine';
import {
  consumeAiQuota,
  getAiQuotaStatus,
  runOfflineNzDiagnosticMatcher
} from '../src/engine/aiDiagnosticsEngine';
import { GardenObstacle, GardenProfile, GardenZone, Planting } from '../src/types/domain';

const sampleProfile: GardenProfile = {
  id: 'prof_1',
  postcode: '5011',
  suburb: 'Fairfield',
  city: 'Lower Hutt',
  latitude: -41.2015,
  longitude: 174.9228,
  streetNumber: 11, // Odd street number
  climateZoneId: 'nz-wellington-hutt',
  councilId: 'hutt-city',
  maramatakaEnabled: true,
  notificationsEnabled: true,
  isPro: false,
  createdAtIso: '2026-11-16T00:00:00Z'
};

const sampleZone: GardenZone = {
  id: 'zone_1',
  profileId: 'prof_1',
  name: 'North Raised Bed',
  zoneType: 'Raised Bed',
  widthCm: 100,
  lengthCm: 200,
  sunAspect: 'North',
  soilType: 'Loam',
  drainage: 'Moderate',
  rainwaterTankConnected: false
};

describe('Aotearoa Garden Planner Core Engines', () => {
  it('skips watering after significant overnight rain', () => {
    const plantings: Planting[] = [
      {
        id: 'p1',
        zoneId: 'zone_1',
        speciesId: 'tomato-beefsteak',
        plantedDateIso: '2026-11-01',
        growthStage: 'Vegetative',
        gridRow: 1,
        gridCol: 1,
        moistureDeficitMm: 14
      }
    ];

    const rec = computeZoneWateringRecommendation({
      profile: sampleProfile,
      zone: sampleZone,
      plantings,
      councilRule: getCouncilRule('wellington-water')!,
      todayWeather: {
        dateIso: '2026-11-16',
        rainfallMm: 15,
        et0Mm: 3.5,
        tempMinC: 11,
        tempMaxC: 19,
        windMaxKmh: 22
      }
    });

    expect(rec.action).toBe('SKIP_RAIN');
    expect(rec.totalZoneLitres).toBe(0);
  });

  it('enforces odd/even council restrictions when deficit exceeds soil threshold', () => {
    const plantings: Planting[] = [
      {
        id: 'p1',
        zoneId: 'zone_1',
        speciesId: 'tomato-beefsteak',
        plantedDateIso: '2026-11-01',
        growthStage: 'Flowering/Fruiting',
        gridRow: 1,
        gridCol: 1,
        moistureDeficitMm: 17
      }
    ];

    // Even date (2026-11-16) with odd street number (11) -> hand-water only under Wellington Water Level 1
    const rec = computeZoneWateringRecommendation({
      profile: sampleProfile,
      zone: sampleZone,
      plantings,
      councilRule: getCouncilRule('wellington-water')!,
      todayWeather: {
        dateIso: '2026-11-16',
        rainfallMm: 0,
        et0Mm: 4.5,
        tempMinC: 12,
        tempMaxC: 23,
        windMaxKmh: 18
      }
    });

    expect(rec.action).toBe('HAND_WATER_ONLY');
    expect(rec.totalZoneLitres).toBeGreaterThan(35);
  });

  it('enforces Level 4 total outdoor ban unless rainwater tank is connected', () => {
    const plantings: Planting[] = [
      {
        id: 'p1',
        zoneId: 'zone_1',
        speciesId: 'tomato-beefsteak',
        plantedDateIso: '2026-11-01',
        growthStage: 'Flowering/Fruiting',
        gridRow: 1,
        gridCol: 1,
        moistureDeficitMm: 20
      }
    ];
    const level4Rule = resolveEffectiveCouncilRule({
      councilId: 'auckland',
      restrictionStageOverride: 4
    });
    expect(level4Rule.provenance).toBe('user-reported');

    const mainsRec = computeZoneWateringRecommendation({
      profile: sampleProfile,
      zone: sampleZone,
      plantings,
      councilRule: level4Rule,
      todayWeather: {
        dateIso: '2026-11-16',
        rainfallMm: 0,
        et0Mm: 4.5,
        tempMinC: 12,
        tempMaxC: 24,
        windMaxKmh: 15
      }
    });
    expect(mainsRec.action).toBe('BAN_EMERGENCY_ONLY');

    const tankRec = computeZoneWateringRecommendation({
      profile: sampleProfile,
      zone: { ...sampleZone, rainwaterTankConnected: true },
      plantings,
      councilRule: level4Rule,
      todayWeather: {
        dateIso: '2026-11-16',
        rainfallMm: 0,
        et0Mm: 4.5,
        tempMinC: 12,
        tempMaxC: 24,
        windMaxKmh: 15
      }
    });
    expect(tankRec.action).toBe('WATER_NOW');
    expect(tankRec.rainwaterTip).toContain('exempt');
  });

  it('blocks NPPA biosecurity weeds and flags companion/spacing rules', () => {
    const existing: Planting[] = [
      {
        id: 'p1',
        zoneId: 'zone_1',
        speciesId: 'tomato-beefsteak',
        plantedDateIso: '2026-11-01',
        growthStage: 'Vegetative',
        gridRow: 1,
        gridCol: 1,
        moistureDeficitMm: 0
      }
    ];

    const weedCheck = validatePlantingPlacement({
      zone: sampleZone,
      candidateSpecies: PLANT_SPECIES_BY_ID['nppa-tradescantia']!,
      targetRow: 2,
      targetCol: 2,
      existingPlantings: existing
    });
    expect(weedCheck.allowed).toBe(false);
    expect(weedCheck.biosecurityBlock).toContain('NPPA');

    const basilCheck = validatePlantingPlacement({
      zone: sampleZone,
      candidateSpecies: PLANT_SPECIES_BY_ID['basil-sweet']!,
      targetRow: 1,
      targetCol: 3, // 50cm away -> meets spacing and triggers companion highlight
      existingPlantings: existing
    });
    expect(basilCheck.allowed).toBe(true);
    expect(basilCheck.companionHighlights.length).toBe(1);
  });

  it('triggers overnight frost-cloth alert when forecast drops to <= 2°C', () => {
    const tasks = generateProactiveCareTasks({
      todayIso: '2026-11-16',
      climateZone: NZ_CLIMATE_ZONES['nz-wellington-hutt']!,
      zones: [sampleZone],
      plantingsByZone: {
        zone_1: [
          {
            id: 'p1',
            zoneId: 'zone_1',
            speciesId: 'tomato-beefsteak',
            plantedDateIso: '2026-11-01',
            growthStage: 'Vegetative',
            gridRow: 1,
            gridCol: 1,
            moistureDeficitMm: 5
          }
        ]
      },
      forecast: [
        {
          dateIso: '2026-11-16',
          rainfallMm: 0,
          et0Mm: 3.5,
          tempMinC: 1.5,
          tempMaxC: 16,
          windMaxKmh: 12
        }
      ],
      maramatakaEnabled: true
    });

    expect(tasks.some((t) => t.category === 'Frost Alert')).toBe(true);
    expect(tasks.some((t) => t.category === 'Maramataka')).toBe(true);
  });

  it('includes all 67 NZ territorial authorities and covers every council in postcode lookup', () => {
    const councilIds = Object.keys(NZ_COUNCIL_WATER_RULES);
    expect(councilIds.length).toBe(67);

    const coveredCouncils = new Set(NZ_POSTCODE_DIRECTORY.map((p) => p.councilId));
    for (const id of councilIds) {
      expect(coveredCouncils.has(id)).toBe(true);
    }

    // Diacritic-insensitive search
    expect(lookupNzLocation('whangarei').length).toBeGreaterThan(0);
    expect(lookupNzLocation('queenstown')[0]?.councilId).toBe('queenstown-lakes');
  });

  it('bundles expanded NZ plant catalog and complete spec pest guide', () => {
    expect(NZ_PLANT_CATALOG.length).toBeGreaterThanOrEqual(150);
    expect(searchPlantCatalog('kumara').some((p) => p.id === 'kumara-owairaka')).toBe(true);
    expect(searchPlantCatalog('', 'NPPA Weed').length).toBeGreaterThanOrEqual(10);

    const pestIds = new Set(NZ_PEST_DISEASE_GUIDE.map((p) => p.id));
    for (const requiredId of [
      'tomato-potato-psyllid',
      'passionvine-hopper',
      'guava-moth',
      'cabbage-white-butterfly',
      'codling-moth',
      'bronze-beetle',
      'slugs-and-snails',
      'powdery-mildew',
      'late-blight'
    ]) {
      expect(pestIds.has(requiredId)).toBe(true);
    }
  });

  it('computes Southern Hemisphere solar positions, South-facing noon shadows, and daily sun exposure', () => {
    const summerNoon = computeSolarPosition({
      latitude: -41.29,
      dayOfYear: SEASON_DAY_OF_YEAR['Summer Solstice (Dec)'],
      hourOfDay: 12
    });
    const winterNoon = computeSolarPosition({
      latitude: -41.29,
      dayOfYear: SEASON_DAY_OF_YEAR['Winter Solstice (Jun)'],
      hourOfDay: 12
    });

    expect(summerNoon.isDaylight).toBe(true);
    expect(winterNoon.isDaylight).toBe(true);
    expect(summerNoon.altitudeDeg).toBeGreaterThan(winterNoon.altitudeDeg);
    expect(summerNoon.azimuthDeg).toBe(0); // Due North at solar noon in NZ

    const winterShadow = computeShadowProjection(200, winterNoon);
    expect(winterShadow.dyCm).toBeGreaterThan(300); // Long shadow cast South (+y)

    const northFence: GardenObstacle = {
      id: 'obs_1',
      profileId: 'prof_1',
      name: 'North Fence',
      obstacleType: 'Fence',
      xCm: 0,
      yCm: 0,
      widthCm: 30,
      lengthCm: 400,
      heightCm: 220
    };
    const shadedBed: GardenZone = {
      ...sampleZone,
      canvasGeometry: { xCm: 50, yCm: 60 }
    };
    const sunSummary = estimateZoneDailySun({
      zone: shadedBed,
      obstacles: [northFence],
      latitude: -41.29,
      dayOfYear: SEASON_DAY_OF_YEAR['Winter Solstice (Jun)']
    });
    expect(sunSummary.sunlitHours).toBeLessThan(6);
  });

  it('flags multi-season crop rotation conflicts and passes healthy family rotations', () => {
    const currentYear = new Date().getFullYear();
    const history = [
      {
        zoneId: 'zone_1',
        speciesId: 'tomato-beefsteak',
        rotationFamily: 'Solanaceae',
        seasonYear: currentYear - 1,
        plantedDateIso: `${currentYear - 1}-11-01`
      }
    ];

    const potatoRotation = checkCropRotation({
      candidateSpecies: PLANT_SPECIES_BY_ID['potato-maincrop']!,
      history,
      currentYear
    });
    expect(potatoRotation.hasWarning).toBe(true);
    expect(potatoRotation.warnings[0]).toContain('Solanaceae');

    const beanRotation = checkCropRotation({
      candidateSpecies: PLANT_SPECIES_BY_ID['dwarf-beans']!,
      history,
      currentYear
    });
    expect(beanRotation.hasWarning).toBe(false);
  });

  it('measures AR corner anchors into 5cm-snapped bed dimensions', () => {
    const measured = computeArBedDimensions({
      corners: [
        { x: 0, z: 0 },
        { x: 2.38, z: 0 },
        { x: 2.38, z: 1.19 },
        { x: 0, z: 1.19 }
      ],
      hasLidar: true
    });
    expect(measured.widthCm).toBe(120);
    expect(measured.lengthCm).toBe(240);
    expect(measured.confidenceLabel).toContain('LiDAR');
  });

  it('enforces AI diagnostic monthly quotas and detects NPPA weeds offline', () => {
    const freeQuota = getAiQuotaStatus(sampleProfile, new Date('2026-11-16T00:00:00Z'));
    expect(freeQuota.monthlyLimit).toBe(3);
    expect(freeQuota.canScan).toBe(true);

    const afterOne = consumeAiQuota(sampleProfile, new Date('2026-11-16T00:00:00Z'));
    expect(getAiQuotaStatus(afterOne, new Date('2026-11-16T00:00:00Z')).remainingTotal).toBe(2);

    const nppaDiag = runOfflineNzDiagnosticMatcher({
      profile: sampleProfile,
      queryNotes: 'Wandering willie tradescantia spreading under trees'
    });
    expect(nppaDiag.isNppaWeed).toBe(true);
    expect(nppaDiag.nppaGuidance).toContain('NPPA');
  });
});
