import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { getAppEnvConfig, isRevenueCatConfigured } from '../config/env';
import { saveGardenProfile } from '../db/database';
import { GardenProfile } from '../types/domain';

export const PRO_GARDEN_PRICE_NZD = '$14.99 NZD (One-Time)';
export const AI_PACK_PRICE_NZD = '$4.99 NZD (+25 AI Scans)';
export const PRO_ENTITLEMENT_ID = 'pro_garden';
export const AI_PACK_PRODUCT_ID = 'ai_scan_pack_25';

export const PRO_FEATURES = [
  'Unlimited garden beds, pots & zones (vs. 3 Free)',
  'Interactive 2D Garden Canvas & NZ Sun-Path Simulator',
  'AR / LiDAR Camera Bed Measurement',
  '30 AI Photo Diagnostics per month (vs. 3 Free)',
  'Optional Supabase Cloud Backup & Multi-Device Sync'
];

let revenueCatInitialized = false;

export async function initializeRevenueCat(appUserId?: string): Promise<boolean> {
  const env = getAppEnvConfig();
  if (!isRevenueCatConfigured(Platform.OS, env)) {
    return false;
  }
  if (revenueCatInitialized) return true;

  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    const apiKey = Platform.OS === 'ios' ? env.revenueCatIosKey : env.revenueCatAndroidKey;
    Purchases.configure({ apiKey, appUserID: appUserId });
    revenueCatInitialized = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Unlocks the one-time "Pro Garden" entitlement via RevenueCat (StoreKit 2 / Google Play)
 * when configured, falling back to local preview unlock in dev/Expo Go environments.
 */
export async function unlockProGarden(profile: GardenProfile): Promise<GardenProfile> {
  const configured = await initializeRevenueCat(profile.id);
  if (configured) {
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.lifetime ?? offerings.current?.availablePackages[0];
      if (pkg) {
        const purchase = await Purchases.purchasePackage(pkg);
        const hasPro = Boolean(purchase.customerInfo.entitlements.active[PRO_ENTITLEMENT_ID]);
        if (!hasPro) {
          throw new Error('Pro Garden entitlement was not activated.');
        }
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Purchase could not be completed.');
    }
  }

  const updated: GardenProfile = {
    ...profile,
    isPro: true
  };
  await saveGardenProfile(updated);
  return updated;
}

export async function restoreProPurchases(profile: GardenProfile): Promise<{
  restored: boolean;
  updatedProfile: GardenProfile;
}> {
  const configured = await initializeRevenueCat(profile.id);
  if (!configured) {
    return { restored: profile.isPro, updatedProfile: profile };
  }

  const info = await Purchases.restorePurchases();
  const hasPro = Boolean(info.entitlements.active[PRO_ENTITLEMENT_ID]);
  if (hasPro && !profile.isPro) {
    const updated: GardenProfile = { ...profile, isPro: true };
    await saveGardenProfile(updated);
    return { restored: true, updatedProfile: updated };
  }
  return { restored: hasPro, updatedProfile: profile };
}

export async function purchaseAiCreditPack(
  profile: GardenProfile,
  credits = 25
): Promise<GardenProfile> {
  const configured = await initializeRevenueCat(profile.id);
  if (configured) {
    const products = await Purchases.getProducts([AI_PACK_PRODUCT_ID]);
    const product = products[0];
    if (product) {
      await Purchases.purchaseStoreProduct(product);
    }
  }

  const updated: GardenProfile = {
    ...profile,
    aiBonusCredits: (profile.aiBonusCredits ?? 0) + credits
  };
  await saveGardenProfile(updated);
  return updated;
}
