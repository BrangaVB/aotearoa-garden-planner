import { NativeModules, Platform } from 'react-native';
import {
  ArBedMeasurement,
  ArPointMeters,
  computeArBedDimensions
} from '../engine/arMeasurementEngine';

interface NativeArMapperModule {
  capturePlaneCorners?: () => Promise<
    [ArPointMeters, ArPointMeters, ArPointMeters, ArPointMeters]
  >;
}

const nativeArMapper = NativeModules.AotearoaArMapper as NativeArMapperModule | undefined;

export function isNativeArAvailable(): boolean {
  return (
    Boolean(nativeArMapper?.capturePlaneCorners) &&
    (Platform.OS === 'ios' || Platform.OS === 'android')
  );
}

/**
 * Captures 4 bed corner points from native ARKit/ARCore when running in an `expo-dev-client`
 * build with the native AR module installed, or falls back to a calibrated sample
 * so users can always adjust dimensions manually.
 */
export async function measureBedWithAr(
  fallbackCorners?: [ArPointMeters, ArPointMeters, ArPointMeters, ArPointMeters]
): Promise<{
  measurement: ArBedMeasurement;
  source: 'native-ar' | 'simulated-fallback';
}> {
  if (nativeArMapper?.capturePlaneCorners) {
    try {
      const corners = await nativeArMapper.capturePlaneCorners();
      if (Array.isArray(corners) && corners.length === 4) {
        return {
          measurement: computeArBedDimensions({ corners, hasLidar: Platform.OS === 'ios' }),
          source: 'native-ar'
        };
      }
    } catch {
      // Fall through to calibrated fallback
    }
  }

  const sample: [ArPointMeters, ArPointMeters, ArPointMeters, ArPointMeters] =
    fallbackCorners ?? [
      { x: 0, z: 0 },
      { x: 2.38, z: 0.02 },
      { x: 2.41, z: 1.18 },
      { x: 0.01, z: 1.21 }
    ];

  return {
    measurement: computeArBedDimensions({
      corners: sample,
      hasLidar: Platform.OS === 'ios'
    }),
    source: 'simulated-fallback'
  };
}
