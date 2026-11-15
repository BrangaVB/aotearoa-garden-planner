import { GardenObstacle, GardenZone, SunRequirement } from '../types/domain';

export type SeasonPreset = 'Summer Solstice (Dec)' | 'Equinox (Mar/Sep)' | 'Winter Solstice (Jun)';

export const SEASON_DAY_OF_YEAR: Record<SeasonPreset, number> = {
  'Summer Solstice (Dec)': 355,
  'Equinox (Mar/Sep)': 80,
  'Winter Solstice (Jun)': 172
};

export interface SolarPosition {
  altitudeDeg: number;
  azimuthDeg: number; // 0 = North, 90 = East, 180 = South, 270 = West
  isDaylight: boolean;
}

export interface ShadowProjection {
  dxCm: number; // +x = East, -x = West
  dyCm: number; // +y = South, -y = North
  lengthCm: number;
}

export interface ZoneSunExposureSummary {
  zoneId: string;
  sunlitHours: number;
  classification: SunRequirement;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Computes Southern Hemisphere solar altitude and azimuth (clockwise from true North)
 * for a given latitude (negative in NZ), day of year (1–365), and local solar hour (0–24).
 */
export function computeSolarPosition(params: {
  latitude: number;
  dayOfYear: number;
  hourOfDay: number;
}): SolarPosition {
  const { latitude, dayOfYear, hourOfDay } = params;
  const latRad = latitude * DEG_TO_RAD;

  // Solar declination in radians
  const declDeg = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const declRad = declDeg * DEG_TO_RAD;

  // Hour angle: 0 at solar noon (12:00), negative in morning, positive in afternoon
  const hourAngleDeg = (hourOfDay - 12) * 15;
  const hourRad = hourAngleDeg * DEG_TO_RAD;

  const sinAlt =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad);
  const clampedSinAlt = Math.max(-1, Math.min(1, sinAlt));
  const altRad = Math.asin(clampedSinAlt);
  const altitudeDeg = Math.round(altRad * RAD_TO_DEG * 10) / 10;

  if (altitudeDeg <= 0) {
    return { altitudeDeg: Math.max(0, altitudeDeg), azimuthDeg: 0, isDaylight: false };
  }

  const cosAlt = Math.cos(altRad);
  const cosAz =
    cosAlt === 0 || Math.cos(latRad) === 0
      ? 1
      : (Math.sin(declRad) - Math.sin(latRad) * clampedSinAlt) /
        (Math.cos(latRad) * cosAlt);
  const clampedCosAz = Math.max(-1, Math.min(1, cosAz));
  let azimuthDeg = Math.acos(clampedCosAz) * RAD_TO_DEG;
  if (hourOfDay > 12) {
    azimuthDeg = 360 - azimuthDeg;
  }

  return {
    altitudeDeg,
    azimuthDeg: Math.round(azimuthDeg * 10) / 10,
    isDaylight: true
  };
}

/**
 * Projects an obstacle's shadow vector on a top-down NZ garden canvas
 * where North is -Y and East is +X.
 */
export function computeShadowProjection(
  heightCm: number,
  solar: SolarPosition,
  maxShadowCm = 1200
): ShadowProjection {
  if (!solar.isDaylight || solar.altitudeDeg <= 1) {
    return { dxCm: 0, dyCm: 0, lengthCm: 0 };
  }
  const rawLength = heightCm / Math.tan(solar.altitudeDeg * DEG_TO_RAD);
  const lengthCm = Math.min(maxShadowCm, Math.max(0, Math.round(rawLength)));
  const azRad = solar.azimuthDeg * DEG_TO_RAD;

  // Sun direction: (+sin(az), -cos(az)); shadow falls opposite
  const dxCm = Math.round(-Math.sin(azRad) * lengthCm);
  const dyCm = Math.round(Math.cos(azRad) * lengthCm);

  return { dxCm, dyCm, lengthCm };
}

/**
 * Checks if a garden bed's center point falls within an obstacle's cast shadow box
 * at a given solar position.
 */
export function isZoneShadedByObstacle(
  zone: GardenZone,
  obstacle: GardenObstacle,
  solar: SolarPosition
): boolean {
  if (!solar.isDaylight) return true;
  const proj = computeShadowProjection(obstacle.heightCm, solar);
  if (proj.lengthCm <= 0) return false;

  const zx = (zone.canvasGeometry?.xCm ?? 50) + zone.lengthCm / 2;
  const zy = (zone.canvasGeometry?.yCm ?? 50) + zone.widthCm / 2;

  const minX = Math.min(obstacle.xCm, obstacle.xCm + proj.dxCm);
  const maxX = Math.max(
    obstacle.xCm + obstacle.lengthCm,
    obstacle.xCm + obstacle.lengthCm + proj.dxCm
  );
  const minY = Math.min(obstacle.yCm, obstacle.yCm + proj.dyCm);
  const maxY = Math.max(
    obstacle.yCm + obstacle.widthCm,
    obstacle.yCm + obstacle.widthCm + proj.dyCm
  );

  return zx >= minX && zx <= maxX && zy >= minY && zy <= maxY;
}

/**
 * Estimates daily sunlit hours for a zone across daylight hours (6am–8pm)
 * given the garden's obstacles and season.
 */
export function estimateZoneDailySun(params: {
  zone: GardenZone;
  obstacles: GardenObstacle[];
  latitude: number;
  dayOfYear: number;
}): ZoneSunExposureSummary {
  const { zone, obstacles, latitude, dayOfYear } = params;
  let sunlitHours = 0;

  for (let hour = 6; hour <= 20; hour++) {
    const solar = computeSolarPosition({ latitude, dayOfYear, hourOfDay: hour });
    if (!solar.isDaylight) continue;
    const shaded = obstacles.some((obs) => isZoneShadedByObstacle(zone, obs, solar));
    if (!shaded) sunlitHours += 1;
  }

  const classification: SunRequirement =
    sunlitHours >= 6 ? 'Full Sun' : sunlitHours >= 3 ? 'Part Shade' : 'Full Shade';

  return {
    zoneId: zone.id,
    sunlitHours,
    classification
  };
}
