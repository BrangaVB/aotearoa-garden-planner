import { DailyWeatherPoint } from '../types/domain';

export type WeatherDataSource = 'live' | 'cache' | 'fallback';

export interface WeatherForecastResult {
  forecast: DailyWeatherPoint[];
  source: WeatherDataSource;
  fetchedAtIso: string;
}

interface CacheEntry {
  forecast: DailyWeatherPoint[];
  fetchedAtMs: number;
  fetchedAtIso: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const FORECAST_CACHE = new Map<string, CacheEntry>();

function buildOfflineFallback(): DailyWeatherPoint[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(today.getTime() + idx * 86400000);
    return {
      dateIso: d.toISOString().slice(0, 10),
      rainfallMm: idx === 2 ? 11.0 : 0.0,
      et0Mm: 3.8,
      tempMinC: 11.0,
      tempMaxC: 20.5,
      windMaxKmh: 24
    };
  });
}

export function clearWeatherCache(): void {
  FORECAST_CACHE.clear();
}

/**
 * Fetches 7-day daily rainfall, reference evapotranspiration (ET0), min/max temp,
 * and wind gusts from Open-Meteo (free, no API key required) with in-memory TTL
 * caching, a 6s network timeout, and an offline NZ normals fallback.
 */
export async function fetchNzWeatherWithMeta(
  latitude: number,
  longitude: number
): Promise<WeatherForecastResult> {
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = FORECAST_CACHE.get(cacheKey);
  const nowMs = Date.now();

  if (cached && nowMs - cached.fetchedAtMs < CACHE_TTL_MS) {
    return {
      forecast: cached.forecast,
      source: 'cache',
      fetchedAtIso: cached.fetchedAtIso
    };
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_min,temperature_2m_max,wind_speed_10m_max` +
    `&timezone=Pacific%2FAuckland&forecast_days=7`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = await res.json();
    const daily = data?.daily;
    if (!daily || !Array.isArray(daily.time)) {
      throw new Error('Malformed Open-Meteo response');
    }

    const forecast: DailyWeatherPoint[] = (daily.time as string[]).map((dateIso, i) => ({
      dateIso,
      rainfallMm: Number(daily.precipitation_sum?.[i] ?? 0),
      et0Mm: Number(daily.et0_fao_evapotranspiration?.[i] ?? 3.5),
      tempMinC: Number(daily.temperature_2m_min?.[i] ?? 10),
      tempMaxC: Number(daily.temperature_2m_max?.[i] ?? 20),
      windMaxKmh: Number(daily.wind_speed_10m_max?.[i] ?? 20)
    }));

    const fetchedAtIso = new Date().toISOString();
    FORECAST_CACHE.set(cacheKey, {
      forecast,
      fetchedAtMs: Date.now(),
      fetchedAtIso
    });

    return { forecast, source: 'live', fetchedAtIso };
  } catch {
    if (cached) {
      return {
        forecast: cached.forecast,
        source: 'cache',
        fetchedAtIso: cached.fetchedAtIso
      };
    }
    return {
      forecast: buildOfflineFallback(),
      source: 'fallback',
      fetchedAtIso: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchNzWeatherForecast(
  latitude: number,
  longitude: number
): Promise<DailyWeatherPoint[]> {
  const result = await fetchNzWeatherWithMeta(latitude, longitude);
  return result.forecast;
}
