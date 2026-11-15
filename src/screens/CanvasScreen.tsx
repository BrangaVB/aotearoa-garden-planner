import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle
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
  GardenObstacle,
  GardenProfile,
  GardenZone,
  ObstacleType,
  Planting
} from '../types/domain';

interface Props {
  profile: GardenProfile;
  zones: GardenZone[];
  plantingsByZone?: Record<string, Planting[]>;
  obstacles: GardenObstacle[];
  selectedZoneId?: string;
  onSelectZoneId?: (zoneId: string) => void;
  onWorkspaceChanged: () => Promise<void>;
  onUnlockPro: () => Promise<void>;
}

interface ObstaclePreset {
  label: string;
  name: string;
  obstacleType: ObstacleType;
  xCm: number;
  yCm: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
}

const SEASONS: Array<{ value: SeasonPreset; label: string }> = [
  { value: 'Summer Solstice (Dec)', label: '☀️ Summer' },
  { value: 'Equinox (Mar/Sep)', label: '🌤️ Equinox' },
  { value: 'Winter Solstice (Jun)', label: '❄️ Winter' }
];
const HOURS: Array<{ hour: number; label: string }> = [
  { hour: 8, label: '8am' },
  { hour: 10, label: '10am' },
  { hour: 12, label: '12pm' },
  { hour: 14, label: '2pm' },
  { hour: 16, label: '4pm' },
  { hour: 18, label: '6pm' }
];
const OBSTACLE_TYPES: ObstacleType[] = ['Fence', 'Tree', 'House Wall', 'Shed'];
const OBSTACLE_PRESETS: ObstaclePreset[] = [
  {
    label: '+ 1.8m Fence',
    name: '1.8m Fence',
    obstacleType: 'Fence',
    xCm: 180,
    yCm: 40,
    widthCm: 40,
    lengthCm: 360,
    heightCm: 180
  },
  {
    label: '+ 3m Tree',
    name: '3m Tree',
    obstacleType: 'Tree',
    xCm: 140,
    yCm: 80,
    widthCm: 140,
    lengthCm: 140,
    heightCm: 300
  },
  {
    label: '+ 4m House Wall',
    name: '4m House Wall',
    obstacleType: 'House Wall',
    xCm: 520,
    yCm: 35,
    widthCm: 60,
    lengthCm: 400,
    heightCm: 400
  }
];

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const NUDGE_STEP_CM = 50;
const CANVAS_WIDTH_PX = 320;
const CANVAS_HEIGHT_PX = 240;
const GARDEN_SPAN_CM = 1000; // 10m × 7.5m backyard viewport
const PX_PER_CM = CANVAS_WIDTH_PX / GARDEN_SPAN_CM;

function formatCardinalDirection(azimuthDeg: number): string {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return CARDINALS[index] ?? 'N';
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

interface DraggableItemProps {
  xCm: number;
  yCm: number;
  maxXCm: number;
  maxYCm: number;
  pxPerCm: number;
  style?: StyleProp<ViewStyle>;
  onSelect?: () => void;
  onDragMove: (xCm: number, yCm: number) => void;
  onDragEnd: (xCm: number, yCm: number) => void;
  children: React.ReactNode;
}

function DraggableCanvasItem({
  xCm,
  yCm,
  maxXCm,
  maxYCm,
  pxPerCm,
  style,
  onSelect,
  onDragMove,
  onDragEnd,
  children
}: DraggableItemProps) {
  const startRef = useRef({ xCm, yCm });
  const latestRef = useRef({ xCm, yCm, maxXCm, maxYCm, pxPerCm, onSelect, onDragMove, onDragEnd });
  latestRef.current = { xCm, yCm, maxXCm, maxYCm, pxPerCm, onSelect, onDragMove, onDragEnd };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startRef.current = {
          xCm: latestRef.current.xCm,
          yCm: latestRef.current.yCm
        };
        latestRef.current.onSelect?.();
      },
      onPanResponderMove: (_, gesture) => {
        const cur = latestRef.current;
        const nextX = clamp(startRef.current.xCm + gesture.dx / cur.pxPerCm, 0, cur.maxXCm);
        const nextY = clamp(startRef.current.yCm + gesture.dy / cur.pxPerCm, 0, cur.maxYCm);
        cur.onDragMove(Math.round(nextX), Math.round(nextY));
      },
      onPanResponderRelease: (_, gesture) => {
        const cur = latestRef.current;
        const nextX = clamp(startRef.current.xCm + gesture.dx / cur.pxPerCm, 0, cur.maxXCm);
        const nextY = clamp(startRef.current.yCm + gesture.dy / cur.pxPerCm, 0, cur.maxYCm);
        cur.onDragEnd(Math.round(nextX), Math.round(nextY));
      }
    })
  ).current;

  return (
    <View style={style} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

export function CanvasScreen({
  profile,
  zones,
  plantingsByZone = {},
  obstacles,
  selectedZoneId: controlledZoneId,
  onSelectZoneId,
  onWorkspaceChanged,
  onUnlockPro
}: Props) {
  const [season, setSeason] = useState<SeasonPreset>('Summer Solstice (Dec)');
  const [hour, setHour] = useState<number>(12);
  const [localZoneId, setLocalZoneId] = useState<string>(zones[0]?.id ?? '');
  const effectiveZoneId = controlledZoneId || localZoneId;
  const setSelectedZoneId = (id: string) => {
    setLocalZoneId(id);
    onSelectZoneId?.(id);
  };
  const [dragOverride, setDragOverride] = useState<{
    kind: 'zone' | 'obstacle';
    id: string;
    xCm: number;
    yCm: number;
  } | null>(null);
  const [showCustomObstacle, setShowCustomObstacle] = useState(false);
  const [newObsName, setNewObsName] = useState('North Boundary Fence');
  const [newObsType, setNewObsType] = useState<ObstacleType>('Fence');
  const [newObsHeightCm, setNewObsHeightCm] = useState('180');

  const dayOfYear = SEASON_DAY_OF_YEAR[season];
  const solar = useMemo(
    () => computeSolarPosition({ latitude: profile.latitude, dayOfYear, hourOfDay: hour }),
    [profile.latitude, dayOfYear, hour]
  );

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === effectiveZoneId) ?? zones[0],
    [zones, effectiveZoneId]
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

  const sunArcProgressPct = useMemo(() => {
    const clampedHour = Math.max(6, Math.min(18, hour));
    return Math.round(((clampedHour - 6) / 12) * 100);
  }, [hour]);

  const sunAltitudePct = useMemo(() => {
    if (!solar.isDaylight) return 0;
    return Math.max(6, Math.min(100, Math.round((solar.altitudeDeg / 85) * 100)));
  }, [solar.isDaylight, solar.altitudeDeg]);

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

  const handleQuickAddPreset = async (preset: ObstaclePreset) => {
    await upsertObstacle({
      id: `obs_${Date.now()}`,
      profileId: profile.id,
      name: preset.name,
      obstacleType: preset.obstacleType,
      xCm: preset.xCm,
      yCm: preset.yCm,
      widthCm: preset.widthCm,
      lengthCm: preset.lengthCm,
      heightCm: preset.heightCm
    });
    await onWorkspaceChanged();
  };

  return (
    <View style={styles.container}>
      {!profile.isPro && (
        <View style={styles.proBanner}>
          <View style={styles.proBannerTextWrap}>
            <Text style={styles.proBannerTitle}>Pro Feature — Unlock $14.99</Text>
            <Text style={styles.proBannerSub}>
              Previewing Sun-Path Canvas: scrub solstices &amp; test shadows before unlocking.
            </Text>
          </View>
          <Pressable style={styles.proBannerBtn} onPress={() => void onUnlockPro()}>
            <Text style={styles.proBannerBtnText}>Unlock</Text>
          </Pressable>
        </View>
      )}

      <View>
        <Text style={styles.sectionTitle}>2D Sun-Path &amp; Shadow Canvas</Text>
        <Text style={styles.sectionSubtitle}>
          Drag beds &amp; shade obstacles around your yard to test shadows and find the sunniest spot.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Season (Southern Hemisphere)</Text>
        <View style={styles.pillRow}>
          {SEASONS.map((s) => (
            <Pressable
              key={s.value}
              onPress={() => setSeason(s.value)}
              style={[styles.chip, styles.chipFlex, season === s.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, season === s.value && styles.chipTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Time of Day</Text>
        <View style={styles.pillRow}>
          {HOURS.map((h) => (
            <Pressable
              key={h.hour}
              onPress={() => setHour(h.hour)}
              style={[styles.chip, styles.chipFlex, hour === h.hour && styles.chipActive]}
            >
              <Text style={[styles.chipText, hour === h.hour && styles.chipTextActive]}>
                {h.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.sunArcPill, !solar.isDaylight && styles.sunArcPillNight]}>
          <View style={styles.sunArcHeader}>
            <Text style={[styles.sunArcTitle, !solar.isDaylight && styles.sunArcTitleNight]}>
              {solar.isDaylight
                ? `☀️ ${solar.altitudeDeg}° Alt · ${formatCardinalDirection(solar.azimuthDeg)} (${solar.azimuthDeg}°)`
                : '🌙 Below horizon — night'}
            </Text>
            <Text style={[styles.sunArcTime, !solar.isDaylight && styles.sunArcTitleNight]}>
              {hour}:00
            </Text>
          </View>
          <View style={styles.sunArcTrack}>
            <View
              style={[
                styles.sunArcFill,
                { width: `${sunAltitudePct}%` },
                !solar.isDaylight && styles.sunArcFillNight
              ]}
            />
            {solar.isDaylight && (
              <View style={[styles.sunArcDot, { left: `${sunArcProgressPct}%` }]} />
            )}
          </View>
        </View>

        <View style={styles.canvas}>
          <Text style={styles.compassNorth}>N (Max NZ Sun)</Text>
          <Text style={styles.compassSouth}>S</Text>
          <Text style={styles.compassWest}>W</Text>
          <Text style={styles.compassEast}>E</Text>

          <View style={styles.compassBadge}>
            <Text style={styles.compassBadgeN}>N</Text>
            <View style={styles.compassBadgeMid}>
              <Text style={styles.compassBadgeDir}>W</Text>
              <Text style={styles.compassBadgeCenter}>+</Text>
              <Text style={styles.compassBadgeDir}>E</Text>
            </View>
            <Text style={styles.compassBadgeDir}>S</Text>
          </View>

          {obstacles.map((obs) => {
            const shadow = computeShadowProjection(obs.heightCm, solar, 450);
            const curXCm =
              dragOverride?.kind === 'obstacle' && dragOverride.id === obs.id
                ? dragOverride.xCm
                : obs.xCm;
            const curYCm =
              dragOverride?.kind === 'obstacle' && dragOverride.id === obs.id
                ? dragOverride.yCm
                : obs.yCm;
            const left = curXCm * PX_PER_CM;
            const top = curYCm * PX_PER_CM;
            const width = Math.max(14, obs.lengthCm * PX_PER_CM);
            const height = Math.max(10, obs.widthCm * PX_PER_CM);

            return (
              <React.Fragment key={obs.id}>
                {solar.isDaylight && shadow.lengthCm > 0 && (
                  <View
                    pointerEvents="none"
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
                <DraggableCanvasItem
                  xCm={curXCm}
                  yCm={curYCm}
                  maxXCm={Math.max(0, GARDEN_SPAN_CM - obs.lengthCm)}
                  maxYCm={Math.max(0, 750 - obs.widthCm)}
                  pxPerCm={PX_PER_CM}
                  onDragMove={(xCm, yCm) =>
                    setDragOverride({ kind: 'obstacle', id: obs.id, xCm, yCm })
                  }
                  onDragEnd={(xCm, yCm) => {
                    setDragOverride(null);
                    void upsertObstacle({ ...obs, xCm, yCm }).then(onWorkspaceChanged);
                  }}
                  style={[styles.obstacleBox, { left, top, width, height }]}
                >
                  <Text style={styles.boxText} numberOfLines={1}>
                    ⠿ {obs.name}
                  </Text>
                </DraggableCanvasItem>
              </React.Fragment>
            );
          })}

          {zones.map((z, idx) => {
            const baseGx = z.canvasGeometry?.xCm ?? 60 + idx * 140;
            const baseGy = z.canvasGeometry?.yCm ?? 220 + idx * 90;
            const gx =
              dragOverride?.kind === 'zone' && dragOverride.id === z.id
                ? dragOverride.xCm
                : baseGx;
            const gy =
              dragOverride?.kind === 'zone' && dragOverride.id === z.id
                ? dragOverride.yCm
                : baseGy;
            const active = selectedZone?.id === z.id;
            const plantCount = (plantingsByZone[z.id] ?? []).length;
            return (
              <DraggableCanvasItem
                key={z.id}
                xCm={gx}
                yCm={gy}
                maxXCm={Math.max(0, GARDEN_SPAN_CM - z.lengthCm)}
                maxYCm={Math.max(0, 750 - z.widthCm)}
                pxPerCm={PX_PER_CM}
                onSelect={() => setSelectedZoneId(z.id)}
                onDragMove={(xCm, yCm) =>
                  setDragOverride({ kind: 'zone', id: z.id, xCm, yCm })
                }
                onDragEnd={(xCm, yCm) => {
                  setDragOverride(null);
                  void updateZoneCanvasGeometry(z.id, { xCm, yCm }).then(onWorkspaceChanged);
                }}
                style={[
                  styles.bedBox,
                  active && styles.bedBoxActive,
                  {
                    left: gx * PX_PER_CM,
                    top: gy * PX_PER_CM,
                    width: Math.max(44, z.lengthCm * PX_PER_CM),
                    height: Math.max(30, z.widthCm * PX_PER_CM)
                  }
                ]}
              >
                <Text style={[styles.bedText, active && styles.bedTextActive]} numberOfLines={1}>
                  ⠿ {z.name}
                </Text>
                <Text style={styles.bedCountText}>{plantCount} 🌱</Text>
              </DraggableCanvasItem>
            );
          })}
        </View>

        {selectedZone && (
          <View style={styles.nudgePanel}>
            <View style={styles.nudgeHeader}>
              <Text style={styles.nudgeLabel}>
                Selected Bed: <Text style={styles.bold}>{selectedZone.name}</Text>
              </Text>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step: {NUDGE_STEP_CM}cm</Text>
              </View>
            </View>
            <View style={styles.nudgeRow}>
              <Pressable
                style={styles.nudgeBtn}
                onPress={() => void handleNudgeZone(-NUDGE_STEP_CM, 0)}
              >
                <Text style={styles.nudgeText}>← W</Text>
              </Pressable>
              <Pressable
                style={styles.nudgeBtn}
                onPress={() => void handleNudgeZone(0, -NUDGE_STEP_CM)}
              >
                <Text style={styles.nudgeText}>↑ N</Text>
              </Pressable>
              <Pressable
                style={styles.nudgeBtn}
                onPress={() => void handleNudgeZone(0, NUDGE_STEP_CM)}
              >
                <Text style={styles.nudgeText}>↓ S</Text>
              </Pressable>
              <Pressable
                style={styles.nudgeBtn}
                onPress={() => void handleNudgeZone(NUDGE_STEP_CM, 0)}
              >
                <Text style={styles.nudgeText}>→ E</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Sun Exposure ({SEASONS.find((s) => s.value === season)?.label ?? season})</Text>
        {zoneSunSummaries.map(({ zone, sun }) => (
          <Text key={zone.id} style={styles.cardText}>
            • {zone.name}: {sun.sunlitHours} hrs/day — <Text style={styles.bold}>{sun.classification}</Text>
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.obsHeaderRow}>
          <Text style={styles.cardTitle}>Shade Obstacles ({obstacles.length})</Text>
          <Pressable
            style={styles.customObsToggle}
            onPress={() => setShowCustomObstacle((prev) => !prev)}
          >
            <Text style={styles.customObsToggleText}>
              {showCustomObstacle ? 'Close' : '+ Custom'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.nudgeRow}>
          {OBSTACLE_PRESETS.map((preset) => (
            <Pressable
              key={preset.label}
              style={styles.presetChip}
              onPress={() => void handleQuickAddPreset(preset)}
            >
              <Text style={styles.presetChipText}>{preset.label}</Text>
            </Pressable>
          ))}
        </View>

        {showCustomObstacle && (
          <View style={styles.customObsBox}>
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
          </View>
        )}

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
  proBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  proBannerTextWrap: { flex: 1, gap: 2 },
  proBannerTitle: { fontSize: 13, fontWeight: '800', color: '#14532D' },
  proBannerSub: { fontSize: 11, color: '#166534', lineHeight: 15 },
  proBannerBtn: {
    backgroundColor: '#15803D',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999
  },
  proBannerBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  bold: { fontWeight: '700', color: '#0F172A' },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  chipScroll: { flexGrow: 0 },
  pillRow: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center'
  },
  chipFlex: { flex: 1 },
  chipActive: { backgroundColor: '#166534', borderColor: '#166534' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  sunArcPill: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6
  },
  sunArcPillNight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1'
  },
  sunArcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  sunArcTitle: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  sunArcTitleNight: { color: '#475569' },
  sunArcTime: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  sunArcTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    position: 'relative',
    justifyContent: 'center'
  },
  sunArcFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#F59E0B'
  },
  sunArcFillNight: {
    backgroundColor: '#94A3B8'
  },
  sunArcDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#D97706',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginLeft: -5
  },
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
  compassWest: {
    position: 'absolute',
    left: 6,
    top: CANVAS_HEIGHT_PX / 2 - 7,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B'
  },
  compassEast: {
    position: 'absolute',
    right: 6,
    top: CANVAS_HEIGHT_PX / 2 - 7,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B'
  },
  compassBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    zIndex: 10
  },
  compassBadgeN: { fontSize: 9, fontWeight: '800', color: '#15803D', lineHeight: 11 },
  compassBadgeMid: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compassBadgeCenter: { fontSize: 9, fontWeight: '700', color: '#94A3B8', lineHeight: 10 },
  compassBadgeDir: { fontSize: 8, fontWeight: '700', color: '#475569', lineHeight: 10 },
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
    backgroundColor: '#5D4037',
    borderWidth: 2,
    borderColor: '#92400E',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3
  },
  bedBoxActive: {
    backgroundColor: '#4E342E',
    borderWidth: 2.5,
    borderColor: '#FBBF24',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3
  },
  bedText: { fontSize: 9, fontWeight: '800', color: '#FEF3C7', textAlign: 'center' },
  bedTextActive: { color: '#FDE68A' },
  bedCountText: { fontSize: 8, fontWeight: '700', color: '#D6D3D1', marginTop: 1 },
  nudgePanel: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 8
  },
  nudgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  nudgeLabel: { fontSize: 12, color: '#334155', flex: 1 },
  stepBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  stepBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  nudgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  nudgeBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6
  },
  nudgeText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  obsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  customObsToggle: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  customObsToggleText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  customObsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  presetChip: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999
  },
  presetChipText: { fontSize: 12, fontWeight: '700', color: '#166534' },
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
