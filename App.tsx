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
  listPlantingsForZone,
  listZonesForProfile,
  recordZoneWatering,
  saveGardenProfile,
  upsertPlanting
} from './src/db/database';
import { generateProactiveCareTasks } from './src/engine/careCalendarEngine';
import { computeZoneWateringRecommendation } from './src/engine/wateringEngine';
import { BedBuilderScreen } from './src/screens/BedBuilderScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { syncGardenNotifications } from './src/services/notificationService';
import {
  fetchNzWeatherWithMeta,
  WeatherDataSource
} from './src/services/weatherService';
import {
  CareTask,
  DailyWeatherPoint,
  GardenProfile,
  GardenZone,
  PlantCategory,
  Planting,
  RestrictionStage,
  WateringRecommendation
} from './src/types/domain';

type Tab = 'Today' | 'Beds' | 'Catalog' | 'Pests';

const CATALOG_CATEGORIES: ('All' | PlantCategory)[] = [
  'All',
  'Vegetable',
  'Herb',
  'Fruit & Citrus',
  'NZ Native',
  'Ornamental',
  'NPPA Weed'
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<GardenProfile | null>(null);
  const [zones, setZones] = useState<GardenZone[]>([]);
  const [plantingsByZone, setPlantingsByZone] = useState<Record<string, Planting[]>>({});
  const [forecast, setForecast] = useState<DailyWeatherPoint[]>([]);
  const [weatherSource, setWeatherSource] = useState<WeatherDataSource>('fallback');
  const [tab, setTab] = useState<Tab>('Today');

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
    for (const z of userZones) {
      map[z.id] = await listPlantingsForZone(z.id);
    }
    const weatherResult = await fetchNzWeatherWithMeta(active.latitude, active.longitude);
    setZones(userZones);
    setPlantingsByZone(map);
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
      ? 'Cached Open-Meteo'
      : 'Offline NZ Normals';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerSub}>
          {profile.postcode} · {profile.suburb} · {councilRule.stageLabel}
        </Text>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Aotearoa Garden</Text>
          <Text style={styles.weatherPill}>{weatherBadgeLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'Today' && (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.badge}>
                    {councilRule.provenance === 'user-reported'
                      ? 'USER-REPORTED RESTRICTION'
                      : 'COUNCIL WATER STATUS'}
                  </Text>
                  <Text style={styles.cardTitle}>{councilRule.authorityName}</Text>
                  <Text style={styles.cardMeta}>{councilRule.allowedHoursLabel}</Text>
                </View>
                <Pressable
                  style={styles.outlineBtn}
                  onPress={() => setShowRestrictionPicker((p) => !p)}
                >
                  <Text style={styles.outlineBtnText}>
                    {showRestrictionPicker ? 'Close' : 'Report Change'}
                  </Text>
                </Pressable>
              </View>

              {showRestrictionPicker && (
                <View style={styles.stageRow}>
                  {([0, 1, 2, 3, 4] as RestrictionStage[]).map((stage) => {
                    const active = councilRule.stage === stage;
                    return (
                      <Pressable
                        key={stage}
                        onPress={() => {
                          setShowRestrictionPicker(false);
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
                        setShowRestrictionPicker(false);
                        void handleUpdateProfile({ restrictionStageOverride: undefined });
                      }}
                      style={styles.stageChip}
                    >
                      <Text style={styles.stageChipText}>Reset Default</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <View style={styles.togglesBar}>
                <View style={styles.toggleItem}>
                  <Text style={styles.toggleLabel}>Alerts</Text>
                  <Switch
                    value={profile.notificationsEnabled !== false}
                    onValueChange={(val) => void handleUpdateProfile({ notificationsEnabled: val })}
                  />
                </View>
                <View style={styles.toggleItem}>
                  <Text style={styles.toggleLabel}>Maramataka</Text>
                  <Switch
                    value={profile.maramatakaEnabled}
                    onValueChange={(val) => void handleUpdateProfile({ maramatakaEnabled: val })}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Smart Watering Today</Text>
            {wateringRecs.map((rec) => (
              <View key={rec.zoneId} style={styles.card}>
                <Text style={styles.cardTitle}>{rec.headline}</Text>
                <Text style={styles.cardText}>{rec.reason}</Text>
                <Text style={styles.cardMeta}>{rec.councilComplianceNote}</Text>
                {rec.rainwaterTip && <Text style={styles.rainwaterTip}>💧 {rec.rainwaterTip}</Text>}
                {rec.totalZoneLitres > 0 && (
                  <Pressable style={styles.btn} onPress={() => handleMarkWatered(rec)}>
                    <Text style={styles.btnText}>Mark Watered ({rec.totalZoneLitres}L)</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Text style={styles.sectionTitle}>Proactive NZ Care Feed</Text>
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
                    <Text style={styles.badge}>
                      {task.category.toUpperCase()} {task.priority === 'High' ? '· HIGH' : ''}
                    </Text>
                    <Text style={styles.cardMeta}>{done ? '✓ Done' : 'Tap to complete'}</Text>
                  </View>
                  <Text style={[styles.cardTitle, done && styles.doneText]}>{task.title}</Text>
                  <Text style={styles.cardText}>{task.description}</Text>
                </Pressable>
              );
            })}
          </>
        )}

        {tab === 'Beds' && (
          <BedBuilderScreen
            profile={profile}
            zones={zones}
            plantingsByZone={plantingsByZone}
            onWorkspaceChanged={() => loadWorkspace(profile)}
          />
        )}

        {tab === 'Catalog' && (
          <>
            <Text style={styles.sectionTitle}>
              NZ Plant & Biosecurity Catalog ({filteredCatalog.length})
            </Text>
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
            {filteredCatalog.map((sp) => (
              <View
                key={sp.id}
                style={[styles.card, sp.isNppaWeed && styles.nppaCard]}
              >
                <Text style={styles.badge}>
                  {sp.isNppaWeed ? '⚠️ NPPA BIOSECURITY WEED' : `${sp.category} · ${sp.waterDemandLabel}`}
                </Text>
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
            ))}
          </>
        )}

        {tab === 'Pests' && (
          <>
            <Text style={styles.sectionTitle}>
              Offline NZ Pest & Disease Field Guide ({filteredPests.length})
            </Text>
            <TextInput
              style={styles.searchInput}
              value={pestQuery}
              onChangeText={setPestQuery}
              placeholder="Search pest, host plant (e.g. Feijoa, Tomato), or symptom..."
              placeholderTextColor="#64748B"
            />
            {filteredPests.map((pest) => (
              <View key={pest.id} style={styles.card}>
                <Text style={styles.badge}>{pest.type}</Text>
                <Text style={styles.cardTitle}>
                  {pest.name}
                  {pest.teReoOrAltName ? ` · ${pest.teReoOrAltName}` : ''}
                </Text>
                <Text style={styles.cardMeta}>Hosts: {pest.hostPlants.join(', ')}</Text>
                <Text style={styles.cardText}>Symptoms: {pest.symptoms}</Text>
                <Text style={styles.cardText}>Organic Remedy: {pest.organicRemedy}</Text>
                <Text style={styles.cardMeta}>Prevention: {pest.preventionTip}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.navBar}>
        {(['Today', 'Beds', 'Catalog', 'Pests'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.navItem, tab === t && styles.navItemActive]}
          >
            <Text style={[styles.navText, tab === t && styles.navTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#166534'
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
    backgroundColor: '#14532D',
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  body: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5
  },
  nppaCard: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  frostCard: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  doneCard: { opacity: 0.6 },
  doneText: { textDecorationLine: 'line-through' },
  badge: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#64748B' },
  cardText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  rainwaterTip: { fontSize: 12, color: '#0369A1', fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  outlineBtnText: { color: '#166534', fontSize: 12, fontWeight: '700' },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
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
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9'
  },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A'
  },
  chipScroll: { flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginRight: 8
  },
  filterChipActive: { backgroundColor: '#166534' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  filterChipTextActive: { color: '#FFFFFF' },
  btn: {
    marginTop: 6,
    backgroundColor: '#15803D',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center'
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  navItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  navItemActive: { borderTopWidth: 3, borderColor: '#166534' },
  navText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  navTextActive: { color: '#166534', fontWeight: '800' }
});
