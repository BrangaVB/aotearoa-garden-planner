import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { CareTask, CouncilWaterRule, WateringRecommendation } from '../types/domain';

export interface PlannedNotification {
  kind: 'watering' | 'frost';
  title: string;
  body: string;
  hour: number;
  minute: number;
}

/**
 * Pure planner that builds the daily local notification payloads from watering
 * recommendations and proactive care tasks. Tested independently of native APIs.
 */
export function buildGardenNotificationPlan(params: {
  wateringRecs: WateringRecommendation[];
  careTasks: CareTask[];
  councilRule: CouncilWaterRule;
}): PlannedNotification[] {
  const { wateringRecs, careTasks, councilRule } = params;
  const plan: PlannedNotification[] = [];

  const needsWater = wateringRecs.filter(
    (r) => r.action === 'WATER_NOW' || r.action === 'HAND_WATER_ONLY'
  );
  const skippedRain = wateringRecs.filter((r) => r.action === 'SKIP_RAIN');

  if (needsWater.length > 0) {
    const names = needsWater.map((r) => r.zoneName).join(', ');
    const totalLitres = Math.round(
      needsWater.reduce((sum, r) => sum + r.totalZoneLitres, 0) * 10
    ) / 10;
    const handOnly = needsWater.some((r) => r.action === 'HAND_WATER_ONLY');
    plan.push({
      kind: 'watering',
      title: handOnly
        ? `Hand-water ${names} (~${totalLitres}L)`
        : `Water ${names} today (~${totalLitres}L)`,
      body: `${councilRule.stageLabel} — ${councilRule.allowedHoursLabel}.`,
      hour: 7,
      minute: 0
    });
  } else if (skippedRain.length > 0 && wateringRecs.length > 0) {
    plan.push({
      kind: 'watering',
      title: 'Skip watering today',
      body: skippedRain[0]!.headline,
      hour: 7,
      minute: 30
    });
  }

  const frostAlerts = careTasks.filter((t) => t.category === 'Frost Alert' && !t.completed);
  if (frostAlerts.length > 0) {
    const first = frostAlerts[0]!;
    plan.push({
      kind: 'frost',
      title: first.title,
      body:
        frostAlerts.length > 1
          ? `${frostAlerts.length} zones have tender plants at risk tonight. Cover with frost cloth before dusk.`
          : first.description,
      hour: 17,
      minute: 30
    });
  }

  return plan;
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('garden-alerts', {
        name: 'Aotearoa Garden Alerts',
        importance: Notifications.AndroidImportance.DEFAULT
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export async function syncGardenNotifications(params: {
  enabled: boolean;
  wateringRecs: WateringRecommendation[];
  careTasks: CareTask[];
  councilRule: CouncilWaterRule;
}): Promise<{ scheduledCount: number; permissionGranted: boolean }> {
  const { enabled, wateringRecs, careTasks, councilRule } = params;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) {
      return { scheduledCount: 0, permissionGranted: true };
    }

    const granted = await ensureNotificationPermissions();
    if (!granted) {
      return { scheduledCount: 0, permissionGranted: false };
    }

    const plan = buildGardenNotificationPlan({ wateringRecs, careTasks, councilRule });
    for (const item of plan) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          sound: true
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: item.hour,
          minute: item.minute
        }
      });
    }

    return { scheduledCount: plan.length, permissionGranted: true };
  } catch {
    return { scheduledCount: 0, permissionGranted: false };
  }
}
