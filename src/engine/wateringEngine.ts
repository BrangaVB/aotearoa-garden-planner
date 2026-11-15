import { PLANT_SPECIES_BY_ID } from '../data/nzPlantCatalog';
import {
  CouncilWaterRule,
  DailyWeatherPoint,
  GardenProfile,
  GardenZone,
  Planting,
  SoilType,
  SunAspect,
  WateringRecommendation
} from '../types/domain';

/**
 * Readily available water (RAW) threshold in mm before irrigation is triggered,
 * calibrated by soil water-holding capacity and container dry-down.
 */
const SOIL_TRIGGER_THRESHOLD_MM: Record<SoilType, number> = {
  Clay: 22,
  Loam: 18,
  'Volcanic/Pumice': 14,
  Sandy: 11,
  'Potting Mix': 8
};

/**
 * Southern Hemisphere solar exposure multiplier by bed aspect.
 * North-facing beds receive peak solar radiation in Aotearoa; South-facing beds are cooler/shaded.
 */
const ASPECT_SHADE_FACTOR: Record<SunAspect, number> = {
  North: 1.05,
  'North-East': 1.0,
  'North-West': 1.02,
  East: 0.9,
  West: 0.92,
  South: 0.72
};

export function isOddEvenDayCompliant(dateIso: string, streetNumber?: number): boolean {
  if (streetNumber === undefined || streetNumber === null) return true;
  const dayOfMonth = Number(dateIso.split('-')[2] ?? '1');
  if (Number.isNaN(dayOfMonth)) return true;
  return dayOfMonth % 2 === streetNumber % 2;
}

export function computeZoneWateringRecommendation(params: {
  profile: GardenProfile;
  zone: GardenZone;
  plantings: Planting[];
  councilRule: CouncilWaterRule;
  todayWeather: DailyWeatherPoint;
  tomorrowWeather?: DailyWeatherPoint;
}): WateringRecommendation {
  const { profile, zone, plantings, councilRule, todayWeather, tomorrowWeather } = params;

  // 1. Determine effective crop coefficient (Kc) across plants in the zone
  let maxKc = 0.65;
  let hasSeedlings = false;
  let previousDeficitMm = 0;

  for (const p of plantings) {
    const species = PLANT_SPECIES_BY_ID[p.speciesId];
    if (species && species.kc > maxKc) {
      maxKc = species.kc;
    }
    if (p.growthStage === 'Seedling') {
      hasSeedlings = true;
    }
    if (p.moistureDeficitMm > previousDeficitMm) {
      previousDeficitMm = p.moistureDeficitMm;
    }
  }

  // Seedlings have shallow roots -> lower deficit threshold (water more frequently, lighter volume)
  const baseThresholdMm = SOIL_TRIGGER_THRESHOLD_MM[zone.soilType];
  const containerFactor = zone.zoneType === 'Patio Pots' ? 0.75 : 1.0;
  const seedlingFactor = hasSeedlings ? 0.65 : 1.0;
  const triggerThresholdMm = Math.round(baseThresholdMm * containerFactor * seedlingFactor * 10) / 10;

  // 2. Effective rainfall (potted plants under eaves/patios capture less rain; heavy downpours partially run off)
  const rainCaptureEfficiency =
    zone.zoneType === 'Patio Pots' ? 0.45 : zone.soilType === 'Clay' ? 0.75 : 0.85;
  const effectiveRainfallMm = todayWeather.rainfallMm * rainCaptureEfficiency;

  // 3. Daily soil moisture deficit balance:
  // Net Deficit_t = max(0, Deficit_{t-1} + (ET0 * Kc * ShadeFactor) - EffectiveRainfall_t)
  const shadeFactor = ASPECT_SHADE_FACTOR[zone.sunAspect];
  const dailyCropEtMm = todayWeather.et0Mm * maxKc * shadeFactor;
  const newDeficitMm = Math.max(
    0,
    Math.round((previousDeficitMm + dailyCropEtMm - effectiveRainfallMm) * 10) / 10
  );

  const areaSqm = Math.max(0.25, (zone.widthCm / 100) * (zone.lengthCm / 100));
  const litresPerSqm = newDeficitMm; // 1 mm water depth = 1 L / m²
  const totalZoneLitres = Math.round(litresPerSqm * areaSqm * 10) / 10;

  const rainwaterTip = zone.rainwaterTankConnected
    ? 'Rainwater tank connected — exempt from municipal supply restrictions.'
    : undefined;

  // 4. Skip if rain already replenished soil moisture or deficit hasn't reached threshold
  if (todayWeather.rainfallMm >= 8 && newDeficitMm < triggerThresholdMm) {
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      dateIso: todayWeather.dateIso,
      action: 'SKIP_RAIN',
      recommendedLitresPerSqm: 0,
      totalZoneLitres: 0,
      newDeficitMm,
      triggerThresholdMm,
      headline: `Skip watering ${zone.name} today — ${todayWeather.rainfallMm.toFixed(0)}mm rain recorded`,
      reason: `Soil moisture deficit is ${newDeficitMm}mm (below your ${zone.soilType} trigger of ${triggerThresholdMm}mm).`,
      councilComplianceNote: `${councilRule.authorityName}: ${councilRule.stageLabel}`,
      rainwaterTip
    };
  }

  if (newDeficitMm < triggerThresholdMm) {
    const forecastRainNote =
      tomorrowWeather && tomorrowWeather.rainfallMm >= 6
        ? ` (${tomorrowWeather.rainfallMm.toFixed(0)}mm rain forecast tomorrow)`
        : '';
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      dateIso: todayWeather.dateIso,
      action: 'SKIP_RAIN',
      recommendedLitresPerSqm: 0,
      totalZoneLitres: 0,
      newDeficitMm,
      triggerThresholdMm,
      headline: `No watering needed for ${zone.name} today${forecastRainNote}`,
      reason: `Current deficit ${newDeficitMm}mm / ${triggerThresholdMm}mm threshold (${zone.soilType}, ${zone.sunAspect}-facing).`,
      councilComplianceNote: `${councilRule.authorityName}: ${councilRule.stageLabel}`,
      rainwaterTip
    };
  }

  // 5. Deficit exceeds threshold — apply NZ Council Water Restriction rules
  if (councilRule.stage === 4 && !zone.rainwaterTankConnected) {
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      dateIso: todayWeather.dateIso,
      action: 'BAN_EMERGENCY_ONLY',
      recommendedLitresPerSqm: litresPerSqm,
      totalZoneLitres,
      newDeficitMm,
      triggerThresholdMm,
      headline: `Level 4 Total Outdoor Water Ban — ${zone.name} (${newDeficitMm}mm deficit)`,
      reason: 'Mains outdoor watering is prohibited. Use greywater (shower/rinse bucket) or rainwater tank only on high-value food crops.',
      councilComplianceNote: councilRule.summary,
      rainwaterTip
    };
  }

  const oddEvenOk = isOddEvenDayCompliant(todayWeather.dateIso, profile.streetNumber);

  if (!councilRule.sprinklersAllowed && councilRule.handHeldHoseAllowed) {
    if (councilRule.oddEvenRule && !oddEvenOk && !zone.rainwaterTankConnected) {
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        dateIso: todayWeather.dateIso,
        action: 'DEFER_RESTRICTION_DAY',
        recommendedLitresPerSqm: litresPerSqm,
        totalZoneLitres,
        newDeficitMm,
        triggerThresholdMm,
        headline: `Hold until tomorrow for ${zone.name} (Odd/Even Council Rule)`,
        reason: `Deficit is ${newDeficitMm}mm, but ${councilRule.authorityName} restricts watering to matching odd/even dates (${councilRule.allowedHoursLabel}).`,
        councilComplianceNote: councilRule.summary,
        rainwaterTip
      };
    }

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      dateIso: todayWeather.dateIso,
      action: 'HAND_WATER_ONLY',
      recommendedLitresPerSqm: litresPerSqm,
      totalZoneLitres,
      newDeficitMm,
      triggerThresholdMm,
      headline: `Hand-water ${zone.name} (~${totalZoneLitres}L) — Sprinklers Restricted`,
      reason: `Deficit reached ${newDeficitMm}mm (${zone.soilType}). Apply ${litresPerSqm}L/m² at root zone using a watering can or trigger-nozzle hose.`,
      councilComplianceNote: `${councilRule.stageLabel}: ${councilRule.allowedHoursLabel}`,
      rainwaterTip
    };
  }

  if (councilRule.oddEvenRule && !oddEvenOk && !zone.rainwaterTankConnected) {
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      dateIso: todayWeather.dateIso,
      action: 'HAND_WATER_ONLY',
      recommendedLitresPerSqm: litresPerSqm,
      totalZoneLitres,
      newDeficitMm,
      triggerThresholdMm,
      headline: `Water ${zone.name} by hand/can (~${totalZoneLitres}L) — Non-Sprinkler Day`,
      reason: `Sprinklers are restricted today under ${councilRule.authorityName} odd/even rules, but hand-held watering cans/hoses are permitted.`,
      councilComplianceNote: councilRule.summary,
      rainwaterTip
    };
  }

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    dateIso: todayWeather.dateIso,
    action: 'WATER_NOW',
    recommendedLitresPerSqm: litresPerSqm,
    totalZoneLitres,
    newDeficitMm,
    triggerThresholdMm,
    headline: `Water ${zone.name} (~${totalZoneLitres}L total / ${litresPerSqm}L per m²)`,
    reason: `Moisture deficit hit ${newDeficitMm}mm (threshold ${triggerThresholdMm}mm for ${zone.soilType}).`,
    councilComplianceNote: `${councilRule.stageLabel} — ${councilRule.allowedHoursLabel}`,
    rainwaterTip
  };
}
