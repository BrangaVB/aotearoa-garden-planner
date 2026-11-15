import { NZ_PLANT_CATALOG, PLANT_SPECIES_BY_ID } from '../data/nzPlantCatalog';
import {
  CareTask,
  ClimateZone,
  DailyWeatherPoint,
  GardenZone,
  Planting
} from '../types/domain';

export interface MaramatakaPhaseInfo {
  phaseName: string;
  energy: 'High Planting & Sowing' | 'Moderate / Fishing & Tending' | 'Rest / Weed & Mulch Only';
  guidance: string;
}

/**
 * Lightweight Maramataka (Māori lunar calendar) phase estimator based on synodic lunar cycle.
 */
export function getMaramatakaPhase(dateIso: string): MaramatakaPhaseInfo {
  const refNewMoonMs = Date.UTC(2026, 0, 19); // Reference lunar epoch
  const targetMs = Date.parse(`${dateIso}T12:00:00Z`);
  const synodicMonthDays = 29.53058867;
  const daysSince = ((targetMs - refNewMoonMs) / 86400000) % synodicMonthDays;
  const lunarDay = Math.floor((daysSince + synodicMonthDays) % synodicMonthDays) + 1;

  if (lunarDay >= 14 && lunarDay <= 17) {
    return {
      phaseName: 'Rākaunui (Full Moon)',
      energy: 'High Planting & Sowing',
      guidance: 'Favourable Maramataka phase for sowing seeds and transplanting above-ground crops.'
    };
  }
  if (lunarDay >= 23 && lunarDay <= 26) {
    return {
      phaseName: 'Tangaroa',
      energy: 'High Planting & Sowing',
      guidance: 'Productive phase for planting root crops, kūmara, and native trees.'
    };
  }
  if (lunarDay >= 28 || lunarDay <= 2) {
    return {
      phaseName: 'Omutu / Whiro',
      energy: 'Rest / Weed & Mulch Only',
      guidance: 'Low-energy lunar phase — hold off sowing seeds; focus on weeding, composting, and soil prep.'
    };
  }
  return {
    phaseName: `Mārama Day ${lunarDay}`,
    energy: 'Moderate / Fishing & Tending',
    guidance: 'Good day for light pruning, liquid seaweed feeding, and pest inspection.'
  };
}

export function generateProactiveCareTasks(params: {
  todayIso: string;
  climateZone: ClimateZone;
  zones: GardenZone[];
  plantingsByZone: Record<string, Planting[]>;
  forecast: DailyWeatherPoint[];
  maramatakaEnabled: boolean;
}): CareTask[] {
  const { todayIso, climateZone, zones, plantingsByZone, forecast, maramatakaEnabled } = params;
  const month = Number(todayIso.split('-')[1] ?? '11');
  const tasks: CareTask[] = [];

  // 1. Overnight Frost-Cloth Alerts when forecast min temp <= 2°C and tender plants are present
  const coldNight = forecast.find((d) => d.tempMinC <= 2.0);
  if (coldNight) {
    for (const zone of zones) {
      const zonePlantings = plantingsByZone[zone.id] ?? [];
      const tenderNames = zonePlantings
        .map((p) => PLANT_SPECIES_BY_ID[p.speciesId])
        .filter((s): s is NonNullable<typeof s> => Boolean(s && s.frostTolerance === 'Tender'))
        .map((s) => s.commonName);

      if (tenderNames.length > 0) {
        tasks.push({
          id: `frost_${zone.id}_${coldNight.dateIso}`,
          zoneId: zone.id,
          title: `Frost Alert (${coldNight.tempMinC}°C): Cover ${zone.name}`,
          category: 'Frost Alert',
          dueDateIso: coldNight.dateIso,
          priority: 'High',
          description: `Overnight low of ${coldNight.tempMinC}°C forecast in ${climateZone.name}. Cover tender ${Array.from(new Set(tenderNames)).join(', ')} with frost cloth before dusk.`,
          completed: false
        });
      }
    }
  }

  // 2. Active planting seasonal care (pruning / harvesting)
  for (const zone of zones) {
    const zonePlantings = plantingsByZone[zone.id] ?? [];
    for (const p of zonePlantings) {
      const species = PLANT_SPECIES_BY_ID[p.speciesId];
      if (!species) continue;

      if (species.pruneMonths.includes(month)) {
        tasks.push({
          id: `prune_${p.id}_${month}`,
          zoneId: zone.id,
          plantingId: p.id,
          title: `Seasonal Pruning: ${species.commonName} (${zone.name})`,
          category: 'Pruning',
          dueDateIso: todayIso,
          priority: 'Normal',
          description: species.careSummary,
          completed: false
        });
      }
    }
  }

  // 3. Regional "What to Sow / Plant This Month" highlights
  const sowNow = NZ_PLANT_CATALOG.filter(
    (s) => !s.isNppaWeed && (s.sowMonths.includes(month) || s.plantMonths.includes(month))
  ).slice(0, 4);

  if (sowNow.length > 0) {
    tasks.push({
      id: `seasonal_sow_${climateZone.id}_${month}`,
      title: `What to Sow & Plant Now (${climateZone.region})`,
      category: 'Sowing',
      dueDateIso: todayIso,
      priority: 'Normal',
      description: `Ideal window for: ${sowNow
        .map((s) => (s.teReoName ? `${s.commonName} (${s.teReoName})` : s.commonName))
        .join(', ')}. Safe spring frost date: ${climateZone.springFrostP90}.`,
      completed: false
    });
  }

  // 4. Optional Maramataka overlay
  if (maramatakaEnabled) {
    const phase = getMaramatakaPhase(todayIso);
    tasks.push({
      id: `maramataka_${todayIso}`,
      title: `Maramataka: ${phase.phaseName} — ${phase.energy}`,
      category: 'Maramataka',
      dueDateIso: todayIso,
      priority: 'Normal',
      description: phase.guidance,
      completed: false
    });
  }

  return tasks;
}
