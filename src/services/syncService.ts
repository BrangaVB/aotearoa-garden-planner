import {
  listPendingSyncItems,
  markSyncItemsCompleted,
  saveGardenProfile
} from '../db/database';
import { GardenProfile } from '../types/domain';

export interface SyncResult {
  status: 'synced' | 'offline-queued' | 'nothing-to-sync';
  pendingCount: number;
  syncedCount: number;
  syncedAtIso?: string;
}

/**
 * Flushes pending local SQLite mutations from `sync_queue` to Supabase REST/RPC
 * when `supabaseUrl` and `accessToken` are configured. Otherwise leaves items queued
 * cleanly for local-first offline operation.
 */
export async function syncPendingChangesToCloud(params: {
  profile: GardenProfile;
  supabaseUrl?: string;
  accessToken?: string;
}): Promise<{ result: SyncResult; updatedProfile: GardenProfile }> {
  const { profile, supabaseUrl, accessToken } = params;
  const pending = await listPendingSyncItems();

  if (pending.length === 0) {
    return {
      result: { status: 'nothing-to-sync', pendingCount: 0, syncedCount: 0 },
      updatedProfile: profile
    };
  }

  if (!supabaseUrl || !accessToken || !profile.isPro) {
    return {
      result: {
        status: 'offline-queued',
        pendingCount: pending.length,
        syncedCount: 0
      },
      updatedProfile: profile
    };
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/apply_garden_sync_batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: accessToken
      },
      body: JSON.stringify({
        profile_id: profile.id,
        items: pending.map((item) => ({
          id: item.id,
          entity_type: item.entityType,
          entity_id: item.entityId,
          operation: item.operation,
          payload: JSON.parse(item.payloadJson) as unknown,
          created_at: item.createdAtIso
        }))
      })
    });

    if (!res.ok) {
      return {
        result: {
          status: 'offline-queued',
          pendingCount: pending.length,
          syncedCount: 0
        },
        updatedProfile: profile
      };
    }

    const syncedAtIso = new Date().toISOString();
    await markSyncItemsCompleted(
      pending.map((p) => p.id),
      syncedAtIso
    );
    const updatedProfile: GardenProfile = {
      ...profile,
      lastSyncedAtIso: syncedAtIso
    };
    await saveGardenProfile(updatedProfile);

    return {
      result: {
        status: 'synced',
        pendingCount: 0,
        syncedCount: pending.length,
        syncedAtIso
      },
      updatedProfile
    };
  } catch {
    return {
      result: {
        status: 'offline-queued',
        pendingCount: pending.length,
        syncedCount: 0
      },
      updatedProfile: profile
    };
  }
}
