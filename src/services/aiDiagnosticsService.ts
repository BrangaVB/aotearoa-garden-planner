import { saveDiagnosisEvent, saveGardenProfile } from '../db/database';
import {
  consumeAiQuota,
  getAiQuotaStatus,
  runOfflineNzDiagnosticMatcher
} from '../engine/aiDiagnosticsEngine';
import { DiagnosisEvent, GardenProfile } from '../types/domain';

export {
  AiQuotaStatus,
  consumeAiQuota,
  FREE_MONTHLY_AI_QUOTA,
  getAiQuotaStatus,
  PRO_MONTHLY_AI_QUOTA,
  runOfflineNzDiagnosticMatcher
} from '../engine/aiDiagnosticsEngine';

/**
 * Runs an AI diagnostic scan via the Supabase Edge Function (`ai-diagnose`) when configured,
 * falling back to the offline NZ biosecurity/pest matcher when offline.
 */
export async function runAiDiagnosticScan(params: {
  profile: GardenProfile;
  zoneId?: string;
  queryNotes: string;
  imageBase64?: string;
  supabaseEdgeUrl?: string;
  supabaseAnonKey?: string;
}): Promise<{ event: DiagnosisEvent; updatedProfile: GardenProfile }> {
  const {
    profile,
    zoneId,
    queryNotes,
    imageBase64,
    supabaseEdgeUrl,
    supabaseAnonKey
  } = params;

  const quota = getAiQuotaStatus(profile);
  if (!quota.canScan) {
    throw new Error('AI_QUOTA_EXCEEDED');
  }

  let event: DiagnosisEvent | null = null;

  if (supabaseEdgeUrl && supabaseAnonKey && imageBase64) {
    try {
      const res = await fetch(`${supabaseEdgeUrl.replace(/\/$/, '')}/functions/v1/ai-diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          profileId: profile.id,
          postcode: profile.postcode,
          climateZoneId: profile.climateZoneId,
          queryNotes,
          imageBase64
        })
      });
      if (res.ok) {
        const data = (await res.json()) as Partial<DiagnosisEvent>;
        if (data.topDiagnosis) {
          event = {
            id: `diag_${Date.now()}`,
            profileId: profile.id,
            zoneId,
            createdAtIso: new Date().toISOString(),
            queryNotes,
            topDiagnosis: data.topDiagnosis,
            confidence: Number(data.confidence ?? 0.8),
            isNppaWeed: Boolean(data.isNppaWeed),
            nppaGuidance: data.nppaGuidance,
            treatmentSteps: Array.isArray(data.treatmentSteps) ? data.treatmentSteps : [],
            source: 'cloud-vision'
          };
        }
      }
    } catch {
      // Fall back to offline matcher below
    }
  }

  if (!event) {
    event = runOfflineNzDiagnosticMatcher({ profile, zoneId, queryNotes });
  }

  const updatedProfile = consumeAiQuota(profile);
  await saveDiagnosisEvent(event);
  await saveGardenProfile(updatedProfile);

  return { event, updatedProfile };
}
