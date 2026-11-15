export interface AppEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  revenueCatIosKey: string;
  revenueCatAndroidKey: string;
}

export function getAppEnvConfig(): AppEnvConfig {
  return {
    supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
    supabaseAnonKey: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
    revenueCatIosKey: (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '').trim(),
    revenueCatAndroidKey: (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '').trim()
  };
}

export function isSupabaseConfigured(env = getAppEnvConfig()): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
}

export function isRevenueCatConfigured(
  platform: 'ios' | 'android' | string,
  env = getAppEnvConfig()
): boolean {
  if (platform === 'ios') return env.revenueCatIosKey.length > 0;
  if (platform === 'android') return env.revenueCatAndroidKey.length > 0;
  return false;
}
