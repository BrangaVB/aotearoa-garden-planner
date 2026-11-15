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

export function OnboardingScreen({ onComplete }: Props) {
  const [query, setQuery] = useState('5011');
  const [selected, setSelected] = useState<PostcodeLookupEntry>(lookupNzLocation('5011')[0]!);
  const [streetNumber, setStreetNumber] = useState('');
  const [maramatakaEnabled, setMaramatakaEnabled] = useState(true);

  const matches = useMemo(() => lookupNzLocation(query), [query]);
  const climate = NZ_CLIMATE_ZONES[selected.climateZoneId]!;
  const council = getCouncilRule(selected.councilId)!;

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>AOTEAROA GARDEN PLANNER</Text>
      <Text style={styles.title}>Where is your garden?</Text>
      <Text style={styles.subtitle}>
        No account required. Enter your NZ postcode, town, or suburb to load local frost dates,
        NIWA climate normals, and your council’s water rules offline.
      </Text>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search NZ postcode or town (e.g. 5011, Queenstown, Whangārei)"
        placeholderTextColor="#64748B"
      />

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
                {item.postcode} · {item.city}
              </Text>
            </Pressable>
          );
        })}
        {matches.length === 0 && (
          <Text style={styles.cardHint}>
            No matching NZ postcode or town found — try a nearby centre (e.g. Auckland, Wellington, Christchurch).
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>CLIMATE ZONE · {climate.region.toUpperCase()}</Text>
        <Text style={styles.cardTitle}>{climate.name}</Text>
        <Text style={styles.cardBody}>
          Last spring frost (90% safe): <Text style={styles.bold}>{climate.springFrostP90}</Text> · First autumn frost: <Text style={styles.bold}>{climate.meanFirstAutumnFrost}</Text>
        </Text>
        <Text style={styles.cardBody}>
          Annual rainfall: <Text style={styles.bold}>{climate.annualRainfallMm}mm</Text>
          {climate.annualSunshineHours ? ` · Sunshine: ${climate.annualSunshineHours} hrs/yr` : ''}
        </Text>
        <Text style={styles.cardHint}>{climate.notes}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>COUNCIL WATER RULES</Text>
        <Text style={styles.cardTitle}>{council.stageLabel}</Text>
        <Text style={styles.cardBody}>
          {council.authorityName}
          {council.waterProvider && council.waterProvider !== council.authorityName
            ? ` (${council.waterProvider})`
            : ''}
        </Text>
        <Text style={styles.cardHint}>{council.summary}</Text>
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
  container: { padding: 20, gap: 14, backgroundColor: '#F8FAFC', flexGrow: 1 },
  kicker: { fontSize: 12, fontWeight: '700', color: '#15803D', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#475569', lineHeight: 20 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A'
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#E2E8F0'
  },
  chipActive: { backgroundColor: '#166534' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  chipTextActive: { color: '#FFFFFF' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#15803D', letterSpacing: 0.8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardBody: { fontSize: 13, color: '#334155' },
  cardHint: { fontSize: 12, color: '#64748B', marginTop: 2 },
  bold: { fontWeight: '700', color: '#0F172A' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  primaryBtn: {
    backgroundColor: '#166534',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
