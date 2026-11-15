import { NZ_PEST_DISEASE_GUIDE } from '../data/nzPestGuide';
import { NZ_PLANT_CATALOG } from '../data/nzPlantCatalog';
import { DiagnosisEvent, GardenProfile } from '../types/domain';

export const FREE_MONTHLY_AI_QUOTA = 3;
export const PRO_MONTHLY_AI_QUOTA = 30;

export interface AiQuotaStatus {
  monthKey: string;
  monthlyLimit: number;
  usedThisMonth: number;
  bonusCredits: number;
  remainingTotal: number;
  canScan: boolean;
}

export function getAiQuotaStatus(
  profile: GardenProfile,
  now = new Date()
): AiQuotaStatus {
  const monthKey = now.toISOString().slice(0, 7); // YYYY-MM
  const monthlyLimit = profile.isPro ? PRO_MONTHLY_AI_QUOTA : FREE_MONTHLY_AI_QUOTA;
  const usedThisMonth =
    profile.aiScansMonthKey === monthKey ? profile.aiScansUsedThisMonth ?? 0 : 0;
  const bonusCredits = profile.aiBonusCredits ?? 0;
  const monthlyRemaining = Math.max(0, monthlyLimit - usedThisMonth);
  const remainingTotal = monthlyRemaining + bonusCredits;

  return {
    monthKey,
    monthlyLimit,
    usedThisMonth,
    bonusCredits,
    remainingTotal,
    canScan: remainingTotal > 0
  };
}

export function consumeAiQuota(
  profile: GardenProfile,
  now = new Date()
): GardenProfile {
  const status = getAiQuotaStatus(profile, now);
  if (status.usedThisMonth < status.monthlyLimit) {
    return {
      ...profile,
      aiScansMonthKey: status.monthKey,
      aiScansUsedThisMonth: status.usedThisMonth + 1
    };
  }
  return {
    ...profile,
    aiScansMonthKey: status.monthKey,
    aiScansUsedThisMonth: status.usedThisMonth,
    aiBonusCredits: Math.max(0, status.bonusCredits - 1)
  };
}

/**
 * Offline NZ biosecurity & pest diagnostic matcher used as fallback when
 * offline or when Supabase Edge Function credentials are not configured.
 */
export function runOfflineNzDiagnosticMatcher(params: {
  profile: GardenProfile;
  zoneId?: string;
  queryNotes: string;
}): DiagnosisEvent {
  const { profile, zoneId, queryNotes } = params;
  const q = queryNotes.toLowerCase();

  // 1. Check NPPA & Regional Pest Plants first (biosecurity priority)
  const nppaMatch = NZ_PLANT_CATALOG.find(
    (p) =>
      p.isNppaWeed &&
      (q.includes(p.commonName.toLowerCase().split(' ')[0] ?? '') ||
        q.includes(p.botanicalName.toLowerCase().split(' ')[0] ?? '') ||
        (q.includes('white') && q.includes('vine') && p.id === 'nppa-moth-plant') ||
        (q.includes('fluffy') && q.includes('clematis') && p.id === 'nppa-old-mans-beard') ||
        (q.includes('wandering') && p.id === 'nppa-tradescantia') ||
        (q.includes('fuzzy') && q.includes('shrub') && p.id === 'nppa-woolly-nightshade'))
  );

  if (nppaMatch) {
    return {
      id: `diag_${Date.now()}`,
      profileId: profile.id,
      zoneId,
      createdAtIso: new Date().toISOString(),
      queryNotes,
      topDiagnosis: nppaMatch.commonName,
      confidence: 0.88,
      isNppaWeed: true,
      nppaGuidance: nppaMatch.nppaDisposalAdvice,
      treatmentSteps: [
        nppaMatch.nppaDisposalAdvice ?? 'Do not compost—bag and dispose to landfill.',
        'Report large infestations to your regional council biosecurity team.'
      ],
      source: 'offline-matcher'
    };
  }

  // 2. Match against NZ Pest & Disease Field Guide
  const scored = NZ_PEST_DISEASE_GUIDE.map((pest) => {
    const tokens = [
      pest.name,
      pest.teReoOrAltName ?? '',
      ...pest.hostPlants,
      pest.symptoms
    ]
      .join(' ')
      .toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length >= 3);
    const hits = words.filter((w) => tokens.includes(w)).length;
    return { pest, hits };
  }).sort((a, b) => b.hits - a.hits);

  const best = scored[0];
  if (best && best.hits > 0) {
    return {
      id: `diag_${Date.now()}`,
      profileId: profile.id,
      zoneId,
      createdAtIso: new Date().toISOString(),
      queryNotes,
      topDiagnosis: `${best.pest.name} (${best.pest.type})`,
      confidence: Math.min(0.92, 0.55 + best.hits * 0.1),
      isNppaWeed: false,
      treatmentSteps: [
        `Organic: ${best.pest.organicRemedy}`,
        `Prevention: ${best.pest.preventionTip}`
      ],
      source: 'offline-matcher'
    };
  }

  return {
    id: `diag_${Date.now()}`,
    profileId: profile.id,
    zoneId,
    createdAtIso: new Date().toISOString(),
    queryNotes,
    topDiagnosis: 'Unmatched Symptom — Check Moisture & Leaf Undersides',
    confidence: 0.42,
    isNppaWeed: false,
    treatmentSteps: [
      'Inspect leaf undersides at dusk for psyllids, aphids, or caterpillars.',
      'Water at root zone in the morning and remove any yellowed lower leaves.'
    ],
    source: 'offline-matcher'
  };
}
