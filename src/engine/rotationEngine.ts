import { PLANT_SPECIES_BY_ID } from '../data/nzPlantCatalog';
import { PlantSpecies, RotationHistoryEntry } from '../types/domain';

export interface RotationCheckResult {
  hasWarning: boolean;
  warnings: string[];
}

/**
 * Families where rotating out for 2–3 seasons prevents soil-borne pests and diseases
 * (e.g., blight/psyllids in Solanaceae, clubroot in Brassicaceae, white rot in Alliums).
 */
const ROTATION_SENSITIVE_FAMILIES = new Set([
  'Solanaceae',
  'Brassicaceae',
  'Amaryllidaceae',
  'Cucurbitaceae',
  'Apiaceae'
]);

export function checkCropRotation(params: {
  candidateSpecies: PlantSpecies;
  history: RotationHistoryEntry[];
  currentYear?: number;
  lookbackSeasons?: number;
}): RotationCheckResult {
  const {
    candidateSpecies,
    history,
    currentYear = new Date().getFullYear(),
    lookbackSeasons = 2
  } = params;

  if (
    candidateSpecies.category === 'NZ Native' ||
    candidateSpecies.category === 'Fruit & Citrus' ||
    candidateSpecies.category === 'NPPA Weed'
  ) {
    return { hasWarning: false, warnings: [] };
  }

  const family = candidateSpecies.rotationFamily;
  const recentSameFamily = history.filter(
    (entry) =>
      entry.rotationFamily === family &&
      entry.seasonYear >= currentYear - lookbackSeasons &&
      entry.speciesId !== candidateSpecies.id
  );

  const exactRepeat = history.filter(
    (entry) =>
      entry.rotationFamily === family &&
      entry.seasonYear >= currentYear - 1 &&
      entry.seasonYear < currentYear
  );

  const warnings: string[] = [];

  if (exactRepeat.length > 0 && ROTATION_SENSITIVE_FAMILIES.has(family)) {
    const prevNames = Array.from(
      new Set(
        exactRepeat.map((e) => PLANT_SPECIES_BY_ID[e.speciesId]?.commonName ?? e.speciesId)
      )
    ).join(', ');
    warnings.push(
      `Crop rotation: ${family} (${prevNames}) grew in this bed last season. Rotate to Fabaceae (beans/peas) or leafy greens to break ${family} pest & blight cycles.`
    );
  } else if (recentSameFamily.length > 0 && ROTATION_SENSITIVE_FAMILIES.has(family)) {
    const prevNames = Array.from(
      new Set(
        recentSameFamily.map((e) => PLANT_SPECIES_BY_ID[e.speciesId]?.commonName ?? e.speciesId)
      )
    ).join(', ');
    warnings.push(
      `Rotation note: ${prevNames} (${family}) was recently planted here. Consider rotating families if disease pressure was high.`
    );
  }

  return {
    hasWarning: warnings.length > 0,
    warnings
  };
}
