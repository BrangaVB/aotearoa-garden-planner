import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  deleteObstacle,
  updateZoneCanvasGeometry,
  upsertObstacle
} from '../db/database';
import {
  computeShadowProjection,
  computeSolarPosition,
  estimateZoneDailySun,
  SEASON_DAY_OF_YEAR,
  SeasonPreset
} from '../engine/sunPathEngine';
import {
  PRO_FEATURES,
  PRO_GARDEN_PRICE_NZD
} from '../services/monetizationService';
import {
  GardenObstacle,
  GardenProfile,
  GardenZone,
  ObstacleType
} from '../types/domain';

interface Props {
  profile: GardenProfile;
  zones: GardenZone[];
  obstacles: GardenObstacle[];
  onWorkspaceChanged: () => Promise<void>;
  onUnlockPro: () => Promise<void>;
}

const SEASONS: SeasonPreset[] = [
  'Summer Solstice (Dec)',
  'Equinox (Mar/Sep)',
  'Winter Solstice (Jun)'
];
const HOURS = [8, 10, 12, 14, 16, 18];
const OBSTACLE_TYPES: ObstacleType[] = ['Fence', 'Tree', 'House Wall', 'Shed'];
const CANVAS_WIDTH_PX = 320;
const CANVAS_HEIGHT_PX = 240;
const GARDEN_SPAN_CM = 1000; // 10m × 7.5m backyard viewport
const PX_PER_CM = CANVAS_WIDTH_PX / GARDEN_SPAN_CM;

export function CanvasScreen({
  profile,
  zones,
  obstacles,
  onWorkspaceChanged,
  onUnlockPro
}: Props) {
  const [season, setSeason] = useState<SeasonPreset>('Summer Solstice (Dec)');
  const [hour, setHour] = useState<number>(12);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.id ?? '');
  const [newObsName, setNewObsName] = useState('North Boundary Fence');
  const [newObsType, setNewObsType] = useState<ObstacleType>('Fence');
  const [newObsHeightCm, setNewObsHeightCm] = useState('180');

  const dayOfYear = SEASON_DAY_OF_YEAR[season];
  const solar = useMemo(
    () => computeSolarPosition({ latitude: profile.latitude, dayOfYear, hourOfDay: hour }),
    [profile.latitude, dayOfYear, hour]
  );

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) ?? zones[0],
    [zones, selectedZoneId]
  );

  const zoneSunSummaries = useMemo(
    () =>
      zones.map((z) => ({
        zone: z,
        sun: estimateZoneDailySun({
          zone: z,
          obstacles,
          latitude: profile.latitude,
          dayOfYear
        })
      })),
    [zones, obstacles, profile.latitude, dayOfYear]
  );

  const handleNudgeZone = async (dxCm: number, dyCm: number) => {
    if (!selectedZone) return;
    const curX = selectedZone.canvasGeometry?.xCm ?? 80;
    const curY = selectedZone.canvasGeometry?.yCm ?? 120;
    const nextX = Math.max(0, Math.min(GARDEN_SPAN_CM - selectedZone.lengthCm, curX + dxCm));
    const nextY = Math.max(0, Math.min(750 - selectedZone.widthCm, curY + dyCm));
    await updateZoneCanvasGeometry(selectedZone.id, { xCm: nextX, yCm: nextY });
    await onWorkspaceChanged();
  };

  const handleAddObstacle = async () => {
    const h = Math.max(50, Number(newObsHeightCm) || 180);
    await upsertObstacle({
      id: `obs_${Date.now()}`,
      profileId: profile.id,
      name: newObsName.trim() || newObsType,
      obstacleType: newObsType,
      xCm: 200,
      yCm: 40,
      widthCm: newObsType === 'Tree' ? 140 : 40,
      lengthCm: newObsType === 'Tree' ? 140 : 350,
      heightCm: h
    });
    await onWorkspaceChanged();
  };

  if (!profile.isPro) {
    return (
      <View style={styles.card}>
        <Text style={styles.badge}>PRO GARDEN FEATURE</Text>
        <Text style={styles.cardTitle}>2D Sun-Path Canvas & Shadow Simulator</Text>
        <Text style={styles.cardText}>
          Drag & position beds, fences, and trees on a 10m×7.5m backyard canvas and scrub Southern
          Hemisphere sun angles across Summer and Winter solstices.
        </Text>
        {PRO_FEATURES.map((f) => (
          <Text key={f} style={styles.featureItem}>
            ✓ {f}
          </Text>
        ))}
        <Pressable style={styles.primaryBtn} onPress={() => void onUnlockPro()}>
          <Text style={styles.primaryBtnText}>Unlock Pro Garden · {PRO_GARDEN_PRICE_NZD}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>2D Sun-Path & Shadow Canvas</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Season (Southern Hemisphere)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {SEASONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSeason(s)}
              style={[styles.chip, season === s && styles.chipActive]}
            >
              <Text style={[styles.chipText, season === s && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Time of Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {HOURS.map((h) => (
            <Pressable
              key={h}
              onPress={() => setHour(h)}
              style={[styles.chip, hour === h && styles.chipActive]}
            >
              <Text style={[styles.chipText, hour === h && styles.chipTextActive]}>
                {h}:00
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.cardMeta}>
          {solar.isDaylight
            ? `Sun Altitude ${solar.altitudeDeg}° · Azimuth ${solar.azimuthDeg}° (0° = Due North)`
            : 'Below horizon — night'}
        </Text>

        <View style={styles.canvas}>
          <Text style={styles.compassNorth}>N (Max NZ Sun)</Text>
          <Text style={styles.compassSouth}>S</Text>

          {obstacles.map((obs) => {
            const shadow = computeShadowProjection(obs.heightCm, solar, 450);
            const left = obs.xCm * PX_PER_CM;
            const top = obs.yCm * PX_PER_CM;
            const width = Math.max(14, obs.lengthCm * PX_PER_CM);
            const height = Math.max(10, obs.widthCm * PX_PER_CM);

            return (
              <React.Fragment key={obs.id}>
                {solar.isDaylight && shadow.lengthCm > 0 && (
                  <View
                    style={[
                      styles.shadowBox,
                      {
                        left: Math.max(0, left + shadow.dxCm * PX_PER_CM),
                        top: Math.max(0, top + shadow.dyCm * PX_PER_CM),
                        width,
                        height
                      }
                    ]}
                  />
                )}
                <View style={[styles.obstacleBox, { left, top, width, height }]}>
                  <Text style={styles.boxText} numberOfLines={1}>
                    {obs.name}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}

          {zones.map((z, idx) => {
            const gx = z.canvasGeometry?.xCm ?? 60 + idx * 140;
            const gy = z.canvasGeometry?.yCm ?? 220 + idx * 90;
            const active = selectedZone?.id === z.id;
            return (
              <Pressable
                key={z.id}
                onPress={() => setSelectedZoneId(z.id)}
                style={[
                  styles.bedBox,
                  active && styles.bedBoxActive,
                  {
                    left: gx * PX_PER_CM,
                    top: gy * PX_PER_CM,
                    width: Math.max(36, z.lengthCm * PX_PER_CM),
                    height: Math.max(26, z.widthCm * PX_PER_CM)
                  }
                ]}
              >
                <Text style={styles.bedText} numberOfLines={2}>
                  {z.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedZone && (
          <View style={styles.nudgeRow}>
            <Text style={styles.cardMeta}>Move {selectedZone.name}:</Text>
            <Pressable style={styles.nudgeBtn} onPress={() => void handleNudgeZone(-50, 0)}>
              <Text style={styles.nudgeText}>← W</Text>
            </Pressable>
            <Pressable style={styles.nudgeBtn} onPress={() => void handleNudgeZone(0, -50)}>
              <Text style={styles.nudgeText}>↑ N</Text>
            </Pressable>
            <Pressable style={styles.nudgeBtn} onPress={() => void handleNudgeZone(0, 50)}>
              <Text style={styles.nudgeText}>↓ S</Text>
            </Pressable>
            <Pressable style={styles.nudgeBtn} onPress={() => void handleNudgeZone(50, 0)}>
              <Text style={styles.nudgeText}>→ E</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Sun Exposure ({season})</Text>
        {zoneSunSummaries.map(({ zone, sun }) => (
          <Text key={zone.id} style={styles.cardText}>
            • {zone.name}: {sun.sunlitHours} hrs/day — <Text style={styles.bold}>{sun.classification}</Text>
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shade Obstacles ({obstacles.length})</Text>
        <TextInput
          style={styles.input}
          value={newObsName}
          onChangeText={setNewObsName}
          placeholder="Obstacle name (e.g. Neighbour Hedge)"
          placeholderTextColor="#64748B"
        />
        <View style={styles.nudgeRow}>
          {OBSTACLE_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setNewObsType(t)}
              style={[styles.chip, newObsType === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, newObsType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={newObsHeightCm}
          onChangeText={setNewObsHeightCm}
          keyboardType="numeric"
          placeholder="Height in cm (e.g. 180)"
          placeholderTextColor="#64748B"
        />
        <Pressable style={styles.primaryBtn} onPress={() => void handleAddObstacle()}>
          <Text style={styles.primaryBtnText}>+ Add Shade Obstacle</Text>
        </Pressable>

        {obstacles.map((obs) => (
          <View key={obs.id} style={styles.obsRow}>
            <Text style={[styles.cardText, { flex: 1 }]}>
              • {obs.name} ({obs.obstacleType}, {obs.heightCm}cm tall)
            </Text>
            <Pressable onPress={() => void deleteObstacle(obs.id).then(onWorkspaceChanged)}>
              <Text style={styles.removeLink}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  badge: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#64748B' },
  cardText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  bold: { fontWeight: '700', color: '#0F172A' },
  featureItem: { fontSize: 13, color: '#15803D', fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  chipScroll: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 6
  },
  chipActive: { backgroundColor: '#166534', borderColor: '#166534' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  canvas: {
    width: CANVAS_WIDTH_PX,
    height: CANVAS_HEIGHT_PX,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    overflow: 'hidden',
    alignSelf: 'center',
    position: 'relative'
  },
  compassNorth: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: '#166534'
  },
  compassSouth: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B'
  },
  shadowBox: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    borderRadius: 4
  },
  obstacleBox: {
    position: 'absolute',
    backgroundColor: '#475569',
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  boxText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  bedBox: {
    position: 'absolute',
    backgroundColor: '#BBF7D0',
    borderWidth: 1,
    borderColor: '#16A34A',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2
  },
  bedBoxActive: { borderWidth: 2, borderColor: '#1D4ED8' },
  bedText: { fontSize: 9, fontWeight: '700', color: '#14532D', textAlign: 'center' },
  nudgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  nudgeBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  nudgeText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A'
  },
  primaryBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  obsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeLink: { color: '#B91C1C', fontSize: 12, fontWeight: '700' }
});
