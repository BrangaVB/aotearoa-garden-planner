import { PLANT_SPECIES_BY_ID } from '../data/nzPlantCatalog';
import { GardenZone, Planting, PlantSpecies } from '../types/domain';

export interface PlacementValidationResult {
  allowed: boolean;
  biosecurityBlock?: string;
  spacingWarnings: string[];
  companionHighlights: string[];
  antagonistWarnings: string[];
}

export function getZoneGridDimensions(zone: GardenZone, cellSizeCm = 25): {
  rows: number;
  cols: number;
  cellSizeCm: number;
} {
  return {
    rows: Math.max(1, Math.floor(zone.widthCm / cellSizeCm)),
    cols: Math.max(1, Math.floor(zone.lengthCm / cellSizeCm)),
    cellSizeCm
  };
}

export function validatePlantingPlacement(params: {
  zone: GardenZone;
  candidateSpecies: PlantSpecies;
  targetRow: number;
  targetCol: number;
  existingPlantings: Planting[];
  cellSizeCm?: number;
}): PlacementValidationResult {
  const {
    candidateSpecies,
    targetRow,
    targetCol,
    existingPlantings,
    cellSizeCm = 25
  } = params;

  // 1. Biosecurity gate: block NPPA pest plants from garden plans
  if (candidateSpecies.isNppaWeed) {
    return {
      allowed: false,
      biosecurityBlock:
        candidateSpecies.nppaDisposalAdvice ??
        `${candidateSpecies.commonName} is listed under the NZ National Pest Plant Accord (NPPA) and cannot be planted.`,
      spacingWarnings: [],
      companionHighlights: [],
      antagonistWarnings: []
    };
  }

  const spacingWarnings: string[] = [];
  const companionHighlights: string[] = [];
  const antagonistWarnings: string[] = [];

  for (const existing of existingPlantings) {
    if (existing.gridRow === targetRow && existing.gridCol === targetCol) {
      continue;
    }
    const neighbor = PLANT_SPECIES_BY_ID[existing.speciesId];
    if (!neighbor) continue;

    const dRow = (existing.gridRow - targetRow) * cellSizeCm;
    const dCol = (existing.gridCol - targetCol) * cellSizeCm;
    const distanceCm = Math.round(Math.sqrt(dRow * dRow + dCol * dCol));

    const requiredSpacingCm = Math.max(candidateSpecies.spacingCm, neighbor.spacingCm);
    if (distanceCm < requiredSpacingCm) {
      spacingWarnings.push(
        `Too close to ${neighbor.commonName} (${distanceCm}cm apart; recommended ${requiredSpacingCm}cm).`
      );
    }

    // Companion & antagonist checks within 75cm neighbourhood
    if (distanceCm <= 75) {
      if (
        candidateSpecies.companions.includes(neighbor.id) ||
        neighbor.companions.includes(candidateSpecies.id)
      ) {
        companionHighlights.push(
          `Great companion pairing: ${candidateSpecies.commonName} + ${neighbor.commonName}`
        );
      }
      if (
        candidateSpecies.antagonists.includes(neighbor.id) ||
        neighbor.antagonists.includes(candidateSpecies.id)
      ) {
        antagonistWarnings.push(
          `Antagonist warning: Keep ${candidateSpecies.commonName} separate from ${neighbor.commonName}.`
        );
      }
    }
  }

  return {
    allowed: true,
    spacingWarnings: Array.from(new Set(spacingWarnings)),
    companionHighlights: Array.from(new Set(companionHighlights)),
    antagonistWarnings: Array.from(new Set(antagonistWarnings))
  };
}
