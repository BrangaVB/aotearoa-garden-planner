import { saveGardenProfile } from '../db/database';
import { GardenProfile } from '../types/domain';

export const PRO_GARDEN_PRICE_NZD = '$14.99 NZD (One-Time)';
export const AI_PACK_PRICE_NZD = '$4.99 NZD (+25 AI Scans)';

export const PRO_FEATURES = [
  'Unlimited garden beds, pots & zones (vs. 3 Free)',
  'Interactive 2D Garden Canvas & NZ Sun-Path Simulator',
  'AR / LiDAR Camera Bed Measurement',
  '30 AI Photo Diagnostics per month (vs. 3 Free)',
  'Optional Supabase Cloud Backup & Multi-Device Sync'
];

/**
 * Unlocks the one-time "Pro Garden" entitlement.
 * In production, validates the StoreKit 2 / Google Play receipt via RevenueCat + Supabase
 * before flipping `isPro` locally.
 */
export async function unlockProGarden(profile: GardenProfile): Promise<GardenProfile> {
  const updated: GardenProfile = {
    ...profile,
    isPro: true
  };
  await saveGardenProfile(updated);
  return updated;
}

export async function purchaseAiCreditPack(
  profile: GardenProfile,
  credits = 25
): Promise<GardenProfile> {
  const updated: GardenProfile = {
    ...profile,
    aiBonusCredits: (profile.aiBonusCredits ?? 0) + credits
  };
  await saveGardenProfile(updated);
  return updated;
}
