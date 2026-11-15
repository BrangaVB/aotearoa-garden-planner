export interface ArPointMeters {
  x: number;
  z: number; // Horizontal depth plane in ARKit/ARCore world coordinates
}

export interface ArBedMeasurement {
  widthCm: number;
  lengthCm: number;
  areaSqm: number;
  confidenceLabel: 'LiDAR (±5cm)' | 'ARCore/ARKit Plane (±10cm)' | 'Manual Estimate';
}

function distMeters(a: ArPointMeters, b: ArPointMeters): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Converts 4 corner anchors captured from ARKit/ARCore plane detection into
 * bed width/length in cm, snapping to 5cm increments for clean grid alignment.
 */
export function computeArBedDimensions(params: {
  corners: [ArPointMeters, ArPointMeters, ArPointMeters, ArPointMeters];
  hasLidar?: boolean;
}): ArBedMeasurement {
  const { corners, hasLidar = false } = params;
  const [p0, p1, p2, p3] = corners;

  const sideA = (distMeters(p0, p1) + distMeters(p3, p2)) / 2;
  const sideB = (distMeters(p1, p2) + distMeters(p0, p3)) / 2;

  const snap5 = (cm: number) => Math.max(25, Math.round(cm / 5) * 5);
  const cmA = snap5(sideA * 100);
  const cmB = snap5(sideB * 100);

  const widthCm = Math.min(cmA, cmB);
  const lengthCm = Math.max(cmA, cmB);
  const areaSqm = Math.round((widthCm / 100) * (lengthCm / 100) * 100) / 100;

  return {
    widthCm,
    lengthCm,
    areaSqm,
    confidenceLabel: hasLidar ? 'LiDAR (±5cm)' : 'ARCore/ARKit Plane (±10cm)'
  };
}
