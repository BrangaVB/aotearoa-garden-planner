import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  getCouncilRule,
  lookupNzLocation,
  NZ_CLIMATE_ZONES
} from '../data/nzClimateAndCouncils';
import { GardenProfile, PostcodeLookupEntry } from '../types/domain';

interface Props {
  onComplete: (profile: GardenProfile) => void;
}

const QUICK_PICK_CITIES = [
  'Auckland',
  'Wellington',
  'Lower Hutt',
  'Christchurch',
  'Tauranga',
  'Queenstown'
] as const;

function formatShortDate(mmdd: string): string {
  const parts = mmdd.split('-');
  const monthIdx = Number(parts[0]) - 1;
  const day = Number(parts[1]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthIdx];
  if (!monthName || Number.isNaN(day)) return mmdd;
  return `${day} ${monthName}`;
}

export function OnboardingScreen({ onComplete }: Props) {
  const [query, setQuery] = useState('5011');
  const [selected, setSelected] = useState<PostcodeLookupEntry>(lookupNzLocation('5011')[0]!);
  const [streetNumber, setStreetNumber] = useState('');
  const [maramatakaEnabled, setMaramatakaEnabled] = useState(true);

  const matches = useMemo(() => lookupNzLocation(query), [query]);
  const climate = NZ_CLIMATE_ZONES[selected.climateZoneId]!;
  const council = getCouncilRule(selected.councilId)!;

  const handleQuickPickCity = (city: string) => {
    setQuery(city);
    const firstMatch = lookupNzLocation(city)[0];
    if (firstMatch) {
      setSelected(firstMatch);
    }
  };

  const handleStart = () => {
    onComplete({
      id: 'local_guest_profile',
      postcode: selected.postcode,
      suburb: selected.suburb,
      city: selected.city,
      latitude: selected.latitude,
      longitude: selected.longitude,
      streetNumber: streetNumber ? Number(streetNumber) : undefined,
      climateZoneId: selected.climateZoneId,
      councilId: selected.councilId,
      maramatakaEnabled,
      notificationsEnabled: true,
      isPro: false,
      createdAtIso: new Date().toISOString()
    });
  };

  const stagePillStyle =
    council.stage === 0
      ? styles.stagePillOk
      : council.stage <= 2
      ? styles.stagePillWarn
      : styles.stagePillAlert;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>AOTEAROA GARDEN PLANNER</Text>
        <Text style={styles.title}>Where is your garden?</Text>
        <Text style={styles.subtitle}>
          No account required. Tap a city or search your NZ postcode or town to load local frost
          dates, NIWA climate normals, and council water rules offline.
        </Text>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.fieldLabel}>Quick-pick NZ cities</Text>
        <View style={styles.chipRow}>
          {QUICK_PICK_CITIES.map((city) => {
            const active = selected.city.toLowerCase() === city.toLowerCase();
            return (
              <Pressable
                key={city}
                onPress={() => handleQuickPickCity(city)}
                style={[styles.quickChip, active && styles.quickChipActive]}
              >
                <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                  {city}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search NZ postcode or town (e.g. 5011, Queenstown, Whangārei)"
          placeholderTextColor="#64748B"
        />
        {query.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={() => setQuery('')}>
            <Text style={styles.clearBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.chipRow}>
        {matches.slice(0, 8).map((item) => {
          const active = item.postcode === selected.postcode;
          return (
            <Pressable
              key={`${item.postcode}-${item.councilId}`}
              onPress={() => setSelected(item)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.postcode} · {item.suburb || item.city}
              </Text>
            </Pressable>
          );
        })}
        {matches.length === 0 && (
          <Text style={styles.cardHint}>
            No matching NZ postcode or town found — try a nearby centre or tap a quick-pick city above.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardLabel}>NIWA CLIMATE ZONE</Text>
          <View style={styles.regionBadge}>
            <Text style={styles.regionBadgeText}>{climate.region}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle}>{climate.name}</Text>

        <View style={styles.statGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Last Spring Frost</Text>
            <Text style={styles.statValue}>{formatShortDate(climate.springFrostP90)}</Text>
            <Text style={styles.statSub}>90% safe</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>First Autumn Frost</Text>
            <Text style={styles.statValue}>{formatShortDate(climate.meanFirstAutumnFrost)}</Text>
            <Text style={styles.statSub}>Mean onset</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Annual Rain</Text>
            <Text style={styles.statValue}>{climate.annualRainfallMm} mm</Text>
            <Text style={styles.statSub}>
              {climate.annualSunshineHours ? `${climate.annualSunshineHours} hrs sun` : climate.windExposure}
            </Text>
          </View>
        </View>

        <Text style={styles.cardSummary}>{climate.notes}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardLabel}>COUNCIL WATER RULES</Text>
          <View style={[styles.stagePill, stagePillStyle]}>
            <Text style={styles.stagePillText}>Level {council.stage}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle}>{council.authorityName}</Text>
        <View style={styles.metaPillRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{council.stageLabel}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{council.allowedHoursLabel}</Text>
          </View>
          {council.oddEvenRule && (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>Odd/Even Days</Text>
            </View>
          )}
        </View>
        {council.waterProvider && council.waterProvider !== council.authorityName && (
          <Text style={styles.providerText}>Water provider: {council.waterProvider}</Text>
        )}
        <Text style={styles.cardSummary}>{council.summary}</Text>
      </View>

      <TextInput
        style={styles.input}
        value={streetNumber}
        onChangeText={setStreetNumber}
        keyboardType="number-pad"
        placeholder="Optional street number (for odd/even watering days)"
        placeholderTextColor="#64748B"
      />

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Maramataka Lunar Overlay</Text>
          <Text style={styles.cardHint}>Show traditional Māori lunar sowing & tending phases</Text>
        </View>
        <Switch value={maramatakaEnabled} onValueChange={setMaramatakaEnabled} />
      </View>

      <Pressable style={styles.primaryBtn} onPress={handleStart}>
        <Text style={styles.primaryBtnText}>Start Planning My Garden</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, backgroundColor: '#F6F7F4', flexGrow: 1 },
  hero: { gap: 4 },
  kicker: { fontSize: 12, fontWeight: '800', color: '#15803D', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#475569', lineHeight: 20 },
  sectionBlock: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A'
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  quickChipActive: { backgroundColor: '#14532D', borderColor: '#14532D' },
  quickChipText: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  quickChipTextActive: { color: '#FFFFFF' },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0'
  },
  chipActive: { backgroundColor: '#166534' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  chipTextActive: { color: '#FFFFFF' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#15803D', letterSpacing: 0.8 },
  regionBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  regionBadgeText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  stagePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999
  },
  stagePillOk: { backgroundColor: '#DCFCE7' },
  stagePillWarn: { backgroundColor: '#FEF3C7' },
  stagePillAlert: { backgroundColor: '#FEE2E2' },
  stagePillText: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  statGrid: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  statSub: { fontSize: 11, color: '#64748B' },
  metaPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8
  },
  metaPillText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  providerText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  cardSummary: { fontSize: 13, color: '#334155', lineHeight: 19 },
  cardHint: { fontSize: 12, color: '#64748B', marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  primaryBtn: {
    backgroundColor: '#166534',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearBtnText: { fontSize: 13, fontWeight: '800', color: '#334155' }
});
