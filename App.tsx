import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  NZ_CLIMATE_ZONES,
  resolveEffectiveCouncilRule
} from './src/data/nzClimateAndCouncils';
import { NZ_PEST_DISEASE_GUIDE } from './src/data/nzPestGuide';
import { searchPlantCatalog } from './src/data/nzPlantCatalog';
import {
  createGardenZone,
  getActiveProfile,
  listDiagnosisEvents,
  listHarvestLogs,
  listObstaclesForProfile,
  listPendingSyncItems,
  listPlantingsForZone,
  listRotationHistoryForZone,
  listZonesForProfile,
  recordZoneWatering,
  saveGardenProfile,
  upsertPlanting
} from './src/db/database';
import { generateProactiveCareTasks } from './src/engine/careCalendarEngine';
import { computeZoneWateringRecommendation } from './src/engine/wateringEngine';
import { BedBuilderScreen } from './src/screens/BedBuilderScreen';
import { CanvasScreen } from './src/screens/CanvasScreen';
import { JournalScreen } from './src/screens/JournalScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import {
  purchaseAiCreditPack,
  unlockProGarden
} from './src/services/monetizationService';
import { syncGardenNotifications } from './src/services/notificationService';
import {
  fetchNzWeatherWithMeta,
  WeatherDataSource
} from './src/services/weatherService';
import {
  CareTask,
  DailyWeatherPoint,
  DiagnosisEvent,
  GardenObstacle,
  GardenProfile,
  GardenZone,
  HarvestLog,
  PlantCategory,
  Planting,
  RestrictionStage,
  RotationHistoryEntry,
  WateringRecommendation
} from './src/types/domain';

type Tab = 'Today' | 'Garden' | 'Catalog' | 'Pests' | 'Journal';
type GardenSubTab = 'Beds' | 'Canvas';
type PestSubTab = 'AI' | 'Guide';

const NAV_ITEMS: { key: Tab; icon: string; label: string }[] = [
  { key: 'Today', icon: '💧', label: 'Today' },
  { key: 'Garden', icon: '🌱', label: 'Garden' },
  { key: 'Catalog', icon: '🌿', label: 'Catalog' },
  { key: 'Pests', icon: '🔍', label: 'Pests & AI' },
  { key: 'Journal', icon: '📓', label: 'Journal' }
];

const CATALOG_CATEGORIES: ('All' | PlantCategory)[] = [
  'All',
  'Vegetable',
  'Herb',
  'Fruit & Citrus',
  'NZ Native',
  'Ornamental',
  'NPPA Weed'
];

function formatForecastDay(dateIso: string, index: number): string {
  if (index === 0) return 'Today';
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso.slice(5);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  return weekdays[parsed.getDay()] ?? dateIso.slice(5);
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<GardenProfile | null>(null);
  const [zones, setZones] = useState<GardenZone[]>([]);
  const [plantingsByZone, setPlantingsByZone] = useState<Record<string, Planting[]>>({});
  const [rotationHistoryByZone, setRotationHistoryByZone] = useState<Record<string, RotationHistoryEntry[]>>({});
  const [obstacles, setObstacles] = useState<GardenObstacle[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisEvent[]>([]);
  const [harvests, setHarvests] = useState<HarvestLog[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [forecast, setForecast] = useState<DailyWeatherPoint[]>([]);
  const [weatherSource, setWeatherSource] = useState<WeatherDataSource>('fallback');

  const [tab, setTab] = useState<Tab>('Today');
  const [gardenSubTab, setGardenSubTab] = useState<GardenSubTab>('Beds');
  const [pestSubTab, setPestSubTab] = useState<PestSubTab>('Guide');

  // UI state for filters, task completion, and restriction reporting
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<'All' | PlantCategory>('All');
  const [pestQuery, setPestQuery] = useState('');
  const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, boolean>>({});
  const [showRestrictionPicker, setShowRestrictionPicker] = useState(false);

  const loadWorkspace = async (active: GardenProfile) => {
    let userZones = await listZonesForProfile(active.id);
    if (userZones.length === 0) {
      const starterZone: GardenZone = {
        id: 'zone_north_raised',
        profileId: active.id,
        name: 'North Raised Bed',
        zoneType: 'Raised Bed',
        widthCm: 120,
        lengthCm: 240,
        sunAspect: 'North',
        soilType: 'Loam',
        drainage: 'Moderate',
        rainwaterTankConnected: false
      };
      await createGardenZone(active, starterZone);
      await upsertPlanting({
        id: 'plant_starter_tomato',
        zoneId: starterZone.id,
        speciesId: 'tomato-beefsteak',
        plantedDateIso: new Date().toISOString().slice(0, 10),
        growthStage: 'Vegetative',
        gridRow: 1,
        gridCol: 1,
        moistureDeficitMm: 16
      });
      await upsertPlanting({
        id: 'plant_starter_basil',
        zoneId: starterZone.id,
        speciesId: 'basil-sweet',
        plantedDateIso: new Date().toISOString().slice(0, 10),
        growthStage: 'Vegetative',
        gridRow: 1,
        gridCol: 3,
        moistureDeficitMm: 16
      });
      userZones = await listZonesForProfile(active.id);
    }

    const map: Record<string, Planting[]> = {};
    const rotMap: Record<string, RotationHistoryEntry[]> = {};
    for (const z of userZones) {
      map[z.id] = await listPlantingsForZone(z.id);
      rotMap[z.id] = await listRotationHistoryForZone(z.id);
    }
    const [obsList, diagList, harvestList, pendingSync, weatherResult] = await Promise.all([
      listObstaclesForProfile(active.id),
      listDiagnosisEvents(active.id),
      listHarvestLogs(active.id),
      listPendingSyncItems(),
      fetchNzWeatherWithMeta(active.latitude, active.longitude)
    ]);

    setZones(userZones);
    setPlantingsByZone(map);
    setRotationHistoryByZone(rotMap);
    setObstacles(obsList);
    setDiagnoses(diagList);
    setHarvests(harvestList);
    setPendingSyncCount(pendingSync.length);
    setForecast(weatherResult.forecast);
    setWeatherSource(weatherResult.source);

    const climateZone = NZ_CLIMATE_ZONES[active.climateZoneId]!;
    const councilRule = resolveEffectiveCouncilRule(active);
    const todayWeather: DailyWeatherPoint = weatherResult.forecast[0] ?? {
      dateIso: new Date().toISOString().slice(0, 10),
      rainfallMm: 0,
      et0Mm: 3.8,
      tempMinC: 11,
      tempMaxC: 20,
      windMaxKmh: 20
    };
    const recs = userZones.map((zone) =>
      computeZoneWateringRecommendation({
        profile: active,
        zone,
        plantings: map[zone.id] ?? [],
        councilRule,
        todayWeather,
        tomorrowWeather: weatherResult.forecast[1]
      })
    );
    const tasks = generateProactiveCareTasks({
      todayIso: todayWeather.dateIso,
      climateZone,
      zones: userZones,
      plantingsByZone: map,
      forecast: weatherResult.forecast,
      maramatakaEnabled: active.maramatakaEnabled
    });
    await syncGardenNotifications({
      enabled: active.notificationsEnabled !== false,
      wateringRecs: recs,
      careTasks: tasks,
      councilRule
    });
  };

  useEffect(() => {
    (async () => {
      const existing = await getActiveProfile();
      if (existing) {
        setProfile(existing);
        await loadWorkspace(existing);
      }
      setLoading(false);
    })();
  }, []);

  const handleOnboardingComplete = async (newProfile: GardenProfile) => {
    setLoading(true);
    await saveGardenProfile(newProfile);
    setProfile(newProfile);
    await loadWorkspace(newProfile);
    setLoading(false);
  };

  const filteredCatalog = useMemo(
    () =>
      searchPlantCatalog(
        catalogQuery,
        catalogCategory === 'All' ? undefined : catalogCategory
      ),
    [catalogQuery, catalogCategory]
  );

  const filteredPests = useMemo(() => {
    const q = pestQuery.trim().toLowerCase();
    if (!q) return NZ_PEST_DISEASE_GUIDE;
    return NZ_PEST_DISEASE_GUIDE.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.hostPlants.some((h) => h.toLowerCase().includes(q)) ||
        p.symptoms.toLowerCase().includes(q)
    );
  }, [pestQuery]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#166534" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </SafeAreaView>
    );
  }

  const climateZone = NZ_CLIMATE_ZONES[profile.climateZoneId]!;
  const councilRule = resolveEffectiveCouncilRule(profile);
  const todayWeather: DailyWeatherPoint = forecast[0] ?? {
    dateIso: new Date().toISOString().slice(0, 10),
    rainfallMm: 0,
    et0Mm: 3.8,
    tempMinC: 11,
    tempMaxC: 20,
    windMaxKmh: 20
  };

  const wateringRecs: WateringRecommendation[] = zones.map((zone) =>
    computeZoneWateringRecommendation({
      profile,
      zone,
      plantings: plantingsByZone[zone.id] ?? [],
      councilRule,
      todayWeather,
      tomorrowWeather: forecast[1]
    })
  );

  const careTasks: CareTask[] = generateProactiveCareTasks({
    todayIso: todayWeather.dateIso,
    climateZone,
    zones,
    plantingsByZone,
    forecast,
    maramatakaEnabled: profile.maramatakaEnabled
  });

  const handleMarkWatered = async (rec: WateringRecommendation) => {
    await recordZoneWatering(
      rec.zoneId,
      rec.totalZoneLitres,
      rec.action,
      new Date().toISOString()
    );
    await loadWorkspace(profile);
  };

  const handleUpdateProfile = async (patch: Partial<GardenProfile>) => {
    const updated: GardenProfile = { ...profile, ...patch };
    await saveGardenProfile(updated);
    setProfile(updated);
    await loadWorkspace(updated);
  };

  const weatherBadgeLabel =
    weatherSource === 'live'
      ? 'Live Open-Meteo'
      : weatherSource === 'cache'
      ? 'Cached Weather'
      : 'Offline Normals';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerSub}>
          {profile.postcode} · {profile.suburb} · {climateZone.region}
        </Text>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Aotearoa Garden</Text>
          <View style={styles.weatherPill}>
            <Text style={styles.weatherPillText}>{weatherBadgeLabel}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'Today' && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.forecastStrip}
              style={styles.forecastScroll}
            >
              {(forecast.length > 0 ? forecast : [todayWeather]).slice(0, 7).map((day, idx) => {
                const isToday = idx === 0;
                const rainIcon =
                  day.rainfallMm >= 3 ? '🌧️' : day.rainfallMm >= 0.5 ? '🌦️' : '☀️';
                const rainLabel =
                  day.rainfallMm >= 0.1 ? `${day.rainfallMm.toFixed(1)}mm` : '0mm';
                return (
                  <View
                    key={`${day.dateIso}-${idx}`}
                    style={[styles.forecastCard, isToday && styles.forecastCardToday]}
                  >
                    <Text style={[styles.forecastDay, isToday && styles.forecastDayToday]}>
                      {formatForecastDay(day.dateIso, idx)}
                    </Text>
                    <Text style={styles.forecastIcon}>{rainIcon}</Text>
                    <Text style={styles.forecastTemp}>
                      {Math.round(day.tempMaxC)}°/{Math.round(day.tempMinC)}°
                    </Text>
                    <Text style={styles.forecastRain}>{rainLabel}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.councilBar}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.councilSummaryText} numberOfLines={1}>
                    Council: <Text style={styles.bold}>{councilRule.authorityName}</Text> · Level{' '}
                    {councilRule.stage}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {councilRule.stageLabel} · {councilRule.allowedHoursLabel}
                    {councilRule.provenance === 'user-reported' ? ' · User-reported' : ''}
                  </Text>
                </View>
                <Pressable
                  style={styles.adjustBtn}
                  onPress={() => setShowRestrictionPicker((p) => !p)}
                >
                  <Text style={styles.adjustBtnText}>
                    {showRestrictionPicker ? 'Done' : 'Adjust'}
                  </Text>
                </Pressable>
              </View>

              {showRestrictionPicker && (
                <View style={styles.councilDrawer}>
                  <Text style={styles.drawerLabel}>Water Restriction Level</Text>
                  <View style={styles.stageRow}>
                    {([0, 1, 2, 3, 4] as RestrictionStage[]).map((stage) => {
                      const active = councilRule.stage === stage;
                      return (
                        <Pressable
                          key={stage}
                          onPress={() => {
                            void handleUpdateProfile({ restrictionStageOverride: stage });
                          }}
                          style={[styles.stageChip, active && styles.stageChipActive]}
                        >
                          <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>
                            Level {stage}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {profile.restrictionStageOverride !== undefined && (
                      <Pressable
                        onPress={() => {
                          void handleUpdateProfile({ restrictionStageOverride: undefined });
                        }}
                        style={styles.stageChip}
                      >
                        <Text style={styles.stageChipText}>Reset Default</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.togglesBar}>
                    <View style={styles.toggleItem}>
                      <Text style={styles.toggleLabel}>Alerts</Text>
                      <Switch
                        value={profile.notificationsEnabled !== false}
                        onValueChange={(val) =>
                          void handleUpdateProfile({ notificationsEnabled: val })
                        }
                      />
                    </View>
                    <View style={styles.toggleItem}>
                      <Text style={styles.toggleLabel}>Maramataka</Text>
                      <Switch
                        value={profile.maramatakaEnabled}
                        onValueChange={(val) =>
                          void handleUpdateProfile({ maramatakaEnabled: val })
                        }
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Smart Watering Today</Text>
              <Text style={styles.sectionCount}>
                {wateringRecs.length} {wateringRecs.length === 1 ? 'zone' : 'zones'}
              </Text>
            </View>
            {wateringRecs.map((rec) => (
              <View key={rec.zoneId} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{rec.zoneName}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      rec.action === 'SKIP_RAIN'
                        ? styles.pillSkip
                        : rec.action === 'WATER_NOW'
                        ? styles.pillWater
                        : styles.pillRestrict
                    ]}
                  >
                    <Text style={styles.statusPillText}>{rec.action.replace(/_/g, ' ')}</Text>
                  </View>
                </View>
                <Text style={styles.cardText}>{rec.headline}</Text>
                <Text style={styles.cardMeta}>{rec.reason}</Text>
                {rec.rainwaterTip && <Text style={styles.rainwaterTip}>💧 {rec.rainwaterTip}</Text>}
                {rec.totalZoneLitres > 0 && (
                  <Pressable style={styles.btn} onPress={() => handleMarkWatered(rec)}>
                    <Text style={styles.btnText}>Mark Watered ({rec.totalZoneLitres}L)</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Proactive NZ Care Feed</Text>
              <Text style={styles.sectionCount}>{careTasks.length} tasks</Text>
            </View>
            {careTasks.map((task) => {
              const done = Boolean(completedTaskIds[task.id]);
              return (
                <Pressable
                  key={task.id}
                  onPress={() =>
                    setCompletedTaskIds((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                  }
                  style={[
                    styles.card,
                    task.category === 'Frost Alert' && styles.frostCard,
                    done && styles.doneCard
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.pillRow}>
                      <View
                        style={[
                          styles.catPill,
                          task.category === 'Frost Alert' && styles.catPillFrost
                        ]}
                      >
                        <Text
                          style={[
                            styles.catPillText,
                            task.category === 'Frost Alert' && styles.catPillFrostText
                          ]}
                        >
                          {task.category.toUpperCase()}
                        </Text>
                      </View>
                      {task.priority === 'High' && (
                        <View style={styles.priorityPill}>
                          <Text style={styles.priorityPillText}>HIGH</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.donePill, done && styles.donePillActive]}>
                      <Text style={[styles.donePillText, done && styles.donePillTextActive]}>
                        {done ? '✓ Done' : '○ Complete'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardTitle, done && styles.doneText]}>{task.title}</Text>
                  <Text style={styles.cardText}>{task.description}</Text>
                </Pressable>
              );
            })}
          </>
        )}

        {tab === 'Garden' && (
          <>
            <View style={styles.segmentedBar}>
              {([
                { key: 'Beds', label: '🌱 Beds & Grid' },
                { key: 'Canvas', label: '☀️ 2D Sun Canvas' }
              ] as { key: GardenSubTab; label: string }[]).map((seg) => {
                const active = gardenSubTab === seg.key;
                return (
                  <Pressable
                    key={seg.key}
                    onPress={() => setGardenSubTab(seg.key)}
                    style={[styles.segmentedBtn, active && styles.segmentedBtnActive]}
                  >
                    <Text style={[styles.segmentedText, active && styles.segmentedTextActive]}>
                      {seg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {gardenSubTab === 'Beds' ? (
              <BedBuilderScreen
                profile={profile}
                zones={zones}
                plantingsByZone={plantingsByZone}
                rotationHistoryByZone={rotationHistoryByZone}
                onWorkspaceChanged={() => loadWorkspace(profile)}
              />
            ) : (
              <CanvasScreen
                profile={profile}
                zones={zones}
                obstacles={obstacles}
                onWorkspaceChanged={() => loadWorkspace(profile)}
                onUnlockPro={async () => {
                  const updated = await unlockProGarden(profile);
                  setProfile(updated);
                  await loadWorkspace(updated);
                }}
              />
            )}
          </>
        )}

        {tab === 'Catalog' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>NZ Plant & Biosecurity Catalog</Text>
              <Text style={styles.sectionCount}>{filteredCatalog.length} species</Text>
            </View>
            <TextInput
              style={styles.searchInput}
              value={catalogQuery}
              onChangeText={setCatalogQuery}
              placeholder="Search common name, Te Reo, botanical, or family..."
              placeholderTextColor="#64748B"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {CATALOG_CATEGORIES.map((cat) => {
                const active = catalogCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCatalogCategory(cat)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {filteredCatalog.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matching plants found</Text>
                <Text style={styles.emptySub}>
                  Try another common or Te Reo name, or clear your current search and category
                  filter.
                </Text>
                <Pressable
                  style={styles.clearBtn}
                  onPress={() => {
                    setCatalogQuery('');
                    setCatalogCategory('All');
                  }}
                >
                  <Text style={styles.clearBtnText}>Clear filter</Text>
                </Pressable>
              </View>
            ) : (
              filteredCatalog.map((sp) => (
                <View
                  key={sp.id}
                  style={[styles.listCard, sp.isNppaWeed && styles.nppaCard]}
                >
                  <View style={styles.rowBetween}>
                    <View style={[styles.catPill, sp.isNppaWeed && styles.catPillNppa]}>
                      <Text style={[styles.catPillText, sp.isNppaWeed && styles.catPillNppaText]}>
                        {sp.isNppaWeed ? '⚠️ NPPA WEED' : sp.category.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.cardMeta}>{sp.waterDemandLabel}</Text>
                  </View>
                  <Text style={styles.cardTitle}>
                    {sp.commonName} {sp.teReoName ? `· ${sp.teReoName}` : ''}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {sp.botanicalName} · Spacing {sp.spacingCm}cm · {sp.frostTolerance}
                  </Text>
                  <Text style={styles.cardText}>
                    {sp.isNppaWeed ? sp.nppaDisposalAdvice : sp.careSummary}
                  </Text>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'Pests' && (
          <>
            <View style={styles.segmentedBar}>
              {([
                { key: 'Guide', label: '🐛 Pest Field Guide' },
                { key: 'AI', label: '📷 AI Diagnostics' }
              ] as { key: PestSubTab; label: string }[]).map((seg) => {
                const active = pestSubTab === seg.key;
                return (
                  <Pressable
                    key={seg.key}
                    onPress={() => setPestSubTab(seg.key)}
                    style={[styles.segmentedBtn, active && styles.segmentedBtnActive]}
                  >
                    <Text style={[styles.segmentedText, active && styles.segmentedTextActive]}>
                      {seg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {pestSubTab === 'AI' ? (
              <JournalScreen
                profile={profile}
                zones={zones}
                diagnoses={diagnoses}
                harvests={harvests}
                pendingSyncCount={pendingSyncCount}
                focusSection="ai"
                onProfileUpdated={setProfile}
                onWorkspaceChanged={() => loadWorkspace(profile)}
                onUnlockPro={async () => {
                  const updated = await unlockProGarden(profile);
                  setProfile(updated);
                  await loadWorkspace(updated);
                }}
                onBuyAiCredits={async () => {
                  const updated = await purchaseAiCreditPack(profile);
                  setProfile(updated);
                  await loadWorkspace(updated);
                }}
              />
            ) : (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>NZ Pest & Disease Field Guide</Text>
                  <Text style={styles.sectionCount}>{filteredPests.length} entries</Text>
                </View>
                <TextInput
                  style={styles.searchInput}
                  value={pestQuery}
                  onChangeText={setPestQuery}
                  placeholder="Search pest, host plant (e.g. Feijoa, Tomato), or symptom..."
                  placeholderTextColor="#64748B"
                />
                {filteredPests.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No matching pests or diseases</Text>
                    <Text style={styles.emptySub}>
                      Try searching by host plant (e.g. Tomato, Citrus, Feijoa) or symptom, or
                      clear the filter.
                    </Text>
                    <Pressable style={styles.clearBtn} onPress={() => setPestQuery('')}>
                      <Text style={styles.clearBtnText}>Clear filter</Text>
                    </Pressable>
                  </View>
                ) : (
                  filteredPests.map((pest) => (
                    <View key={pest.id} style={styles.listCard}>
                      <View style={styles.catPill}>
                        <Text style={styles.catPillText}>{pest.type.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.cardTitle}>
                        {pest.name}
                        {pest.teReoOrAltName ? ` · ${pest.teReoOrAltName}` : ''}
                      </Text>
                      <Text style={styles.cardMeta}>Hosts: {pest.hostPlants.join(', ')}</Text>
                      <Text style={styles.cardText}>
                        <Text style={styles.bold}>Symptoms: </Text>
                        {pest.symptoms}
                      </Text>
                      <Text style={styles.cardText}>
                        <Text style={styles.bold}>Organic Remedy: </Text>
                        {pest.organicRemedy}
                      </Text>
                      <Text style={styles.cardMeta}>Prevention: {pest.preventionTip}</Text>
                    </View>
                  ))
                )}
              </>
            )}
          </>
        )}

        {tab === 'Journal' && (
          <JournalScreen
            profile={profile}
            zones={zones}
            diagnoses={diagnoses}
            harvests={harvests}
            pendingSyncCount={pendingSyncCount}
            focusSection="journal"
            onProfileUpdated={setProfile}
            onWorkspaceChanged={() => loadWorkspace(profile)}
            onUnlockPro={async () => {
              const updated = await unlockProGarden(profile);
              setProfile(updated);
              await loadWorkspace(updated);
            }}
            onBuyAiCredits={async () => {
              const updated = await purchaseAiCreditPack(profile);
              setProfile(updated);
              await loadWorkspace(updated);
            }}
          />
        )}
      </ScrollView>

      <View style={styles.navBar}>
        {NAV_ITEMS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.navItem, active && styles.navItemActive]}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navText, active && styles.navTextActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F7F4' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7F4' },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#14532D',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2
  },
  headerSub: { color: '#BBF7D0', fontSize: 12, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  weatherPill: {
    backgroundColor: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  weatherPillText: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '700'
  },
  body: { padding: 16, gap: 12 },
  forecastScroll: { flexGrow: 0 },
  forecastStrip: { gap: 8, paddingVertical: 2 },
  forecastCard: {
    width: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 3
  },
  forecastCardToday: {
    backgroundColor: '#ECFDF5',
    borderColor: '#86EFAC'
  },
  forecastDay: { fontSize: 11, fontWeight: '700', color: '#475569' },
  forecastDayToday: { color: '#14532D', fontWeight: '800' },
  forecastIcon: { fontSize: 16 },
  forecastTemp: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  forecastRain: { fontSize: 11, fontWeight: '600', color: '#0369A1' },
  councilBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10
  },
  councilSummaryText: { fontSize: 13, color: '#1E293B' },
  bold: { fontWeight: '700', color: '#0F172A' },
  adjustBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  adjustBtnText: { color: '#14532D', fontSize: 12, fontWeight: '700' },
  councilDrawer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8
  },
  drawerLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sectionCount: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8
  },
  nppaCard: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  frostCard: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  doneCard: { opacity: 0.65, backgroundColor: '#F8FAFC' },
  doneText: { textDecorationLine: 'line-through', color: '#64748B' },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  catPillFrost: { backgroundColor: '#DBEAFE' },
  catPillNppa: { backgroundColor: '#FEE2E2' },
  catPillText: { fontSize: 10, fontWeight: '800', color: '#15803D', letterSpacing: 0.4 },
  catPillFrostText: { color: '#1D4ED8' },
  catPillNppaText: { color: '#B91C1C' },
  priorityPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999
  },
  priorityPillText: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  donePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999
  },
  donePillActive: { backgroundColor: '#DCFCE7' },
  donePillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  donePillTextActive: { color: '#166534' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#64748B' },
  cardText: { fontSize: 13, color: '#334155', lineHeight: 19 },
  rainwaterTip: { fontSize: 12, color: '#0369A1', fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillSkip: { backgroundColor: '#E0F2FE' },
  pillWater: { backgroundColor: '#DCFCE7' },
  pillRestrict: { backgroundColor: '#FEF3C7' },
  statusPillText: { fontSize: 10, fontWeight: '800', color: '#0F172A' },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stageChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  stageChipActive: { backgroundColor: '#166534', borderColor: '#166534' },
  stageChipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  stageChipTextActive: { color: '#FFFFFF' },
  togglesBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9'
  },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    gap: 4
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center'
  },
  segmentedBtnActive: { backgroundColor: '#FFFFFF' },
  segmentedText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  segmentedTextActive: { color: '#14532D', fontWeight: '800' },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A'
  },
  chipScroll: { flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginRight: 8
  },
  filterChipActive: { backgroundColor: '#166534' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  filterChipTextActive: { color: '#FFFFFF' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    gap: 8
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19 },
  clearBtn: {
    marginTop: 4,
    backgroundColor: '#166534',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999
  },
  clearBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btn: {
    marginTop: 6,
    backgroundColor: '#15803D',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingBottom: 4
  },
  navItem: { flex: 1, paddingVertical: 8, alignItems: 'center', gap: 2 },
  navItemActive: { borderTopWidth: 3, borderColor: '#14532D', backgroundColor: '#F0FDF4' },
  navIcon: { fontSize: 16 },
  navText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  navTextActive: { color: '#14532D', fontWeight: '800' }
});
