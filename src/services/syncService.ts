import { getAppEnvConfig, isSupabaseConfigured } from '../config/env';
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

export interface CloudAuthResult {
  ok: boolean;
  accessToken?: string;
  userId?: string;
  email?: string;
  message: string;
}

/**
 * Sends a Supabase passwordless magic-link email for guest-to-cloud migration.
 */
export async function requestEmailMagicLink(email: string): Promise<CloudAuthResult> {
  const env = getAppEnvConfig();
  if (!isSupabaseConfigured(env)) {
    return {
      ok: false,
      message: 'Supabase env vars not set; staying in local-first offline mode.'
    };
  }

  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, '')}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.supabaseAnonKey
      },
      body: JSON.stringify({
        email: email.trim(),
        create_user: true
      })
    });

    if (!res.ok) {
      return { ok: false, message: `Unable to send magic link (${res.status}).` };
    }
    return {
      ok: true,
      email: email.trim(),
      message: `Magic link sent to ${email.trim()}. Check your inbox to complete sign-in.`
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Network error sending magic link.'
    };
  }
}

/**
 * Signs in with email + password against Supabase Auth to obtain an access token.
 */
export async function signInWithSupabasePassword(
  email: string,
  password: string
): Promise<CloudAuthResult> {
  const env = getAppEnvConfig();
  if (!isSupabaseConfigured(env)) {
    return {
      ok: false,
      message: 'Supabase env vars not set; staying in local-first offline mode.'
    };
  }

  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.supabaseAnonKey
        },
        body: JSON.stringify({ email: email.trim(), password })
      }
    );

    if (!res.ok) {
      return { ok: false, message: `Sign-in failed (${res.status}). Check email/password.` };
    }

    const data = (await res.json()) as {
      access_token?: string;
      user?: { id?: string; email?: string };
    };
    if (!data.access_token) {
      return { ok: false, message: 'No access token returned by Supabase Auth.' };
    }

    return {
      ok: true,
      accessToken: data.access_token,
      userId: data.user?.id,
      email: data.user?.email ?? email.trim(),
      message: `Signed in as ${data.user?.email ?? email.trim()}.`
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Network error signing in.'
    };
  }
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
  const env = getAppEnvConfig();
  const supabaseUrl = params.supabaseUrl ?? env.supabaseUrl;
  const { profile, accessToken } = params;
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
        apikey: env.supabaseAnonKey || accessToken
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
