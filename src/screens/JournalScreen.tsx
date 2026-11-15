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
  NZ_PLANT_CATALOG,
  PLANT_SPECIES_BY_ID
} from '../data/nzPlantCatalog';
import {
  createGardenZone,
  saveHarvestLog
} from '../db/database';
import { computeArBedDimensions } from '../engine/arMeasurementEngine';
import {
  getAiQuotaStatus,
  runAiDiagnosticScan
} from '../services/aiDiagnosticsService';
import {
  AI_PACK_PRICE_NZD,
  PRO_GARDEN_PRICE_NZD
} from '../services/monetizationService';
import { syncPendingChangesToCloud } from '../services/syncService';
import {
  DiagnosisEvent,
  GardenProfile,
  GardenZone,
  HarvestLog
} from '../types/domain';

interface Props {
  profile: GardenProfile;
  zones: GardenZone[];
  diagnoses: DiagnosisEvent[];
  harvests: HarvestLog[];
  pendingSyncCount: number;
  onProfileUpdated: (updated: GardenProfile) => void;
  onWorkspaceChanged: () => Promise<void>;
  onUnlockPro: () => Promise<void>;
  onBuyAiCredits: () => Promise<void>;
}

export function JournalScreen({
  profile,
  zones,
  diagnoses,
  harvests,
  pendingSyncCount,
  onProfileUpdated,
  onWorkspaceChanged,
  onUnlockPro,
  onBuyAiCredits
}: Props) {
  // AI Diagnostics state
  const [diagNotes, setDiagNotes] = useState('');
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  // Harvest Log state
  const [harvestZoneId, setHarvestZoneId] = useState(zones[0]?.id ?? '');
  const [harvestSpeciesId, setHarvestSpeciesId] = useState('tomato-beefsteak');
  const [quantityLabel, setQuantityLabel] = useState('1.2 kg');
  const [weightGrams, setWeightGrams] = useState('1200');
  const [harvestNotes, setHarvestNotes] = useState('');

  // AR Bed Mapper state (with manual dimension fallback)
  const [arBedName, setArBedName] = useState('AR Measured Bed');
  const [arWidthCm, setArWidthCm] = useState('120');
  const [arLengthCm, setArLengthCm] = useState('240');
  const [arStatus, setArStatus] = useState<string | null>(null);

  // Sync status
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const quota = useMemo(() => getAiQuotaStatus(profile), [profile]);
  const edibleSpecies = useMemo(
    () =>
      NZ_PLANT_CATALOG.filter(
        (p) => !p.isNppaWeed && (p.category === 'Vegetable' || p.category === 'Fruit & Citrus' || p.category === 'Herb')
      ).slice(0, 18),
    []
  );

  const handleRunDiagnosis = async () => {
    setDiagError(null);
    const trimmed = diagNotes.trim();
    if (!trimmed) {
      setDiagError('Describe the leaf symptoms, insect, or mystery weed first.');
      return;
    }
    setDiagBusy(true);
    try {
      const { updatedProfile } = await runAiDiagnosticScan({
        profile,
        zoneId: zones[0]?.id,
        queryNotes: trimmed
      });
      onProfileUpdated(updatedProfile);
      setDiagNotes('');
      await onWorkspaceChanged();
    } catch (err) {
      setDiagError(
        err instanceof Error && err.message === 'AI_QUOTA_EXCEEDED'
          ? 'Monthly AI scan quota reached. Unlock Pro Garden or add a credit pack.'
          : 'Unable to run diagnostic scan.'
      );
    } finally {
      setDiagBusy(false);
    }
  };

  const handleLogHarvest = async () => {
    const zId = harvestZoneId || zones[0]?.id;
    if (!zId || !quantityLabel.trim()) return;
    await saveHarvestLog({
      id: `harv_${Date.now()}`,
      profileId: profile.id,
      zoneId: zId,
      speciesId: harvestSpeciesId,
      harvestedAtIso: new Date().toISOString().slice(0, 10),
      quantityLabel: quantityLabel.trim(),
      weightGrams: Number(weightGrams) || undefined,
      notes: harvestNotes.trim() || undefined
    });
    setHarvestNotes('');
    await onWorkspaceChanged();
  };

  const handleSimulateArCapture = () => {
    const measured = computeArBedDimensions({
      corners: [
        { x: 0, z: 0 },
        { x: 2.38, z: 0.02 },
        { x: 2.41, z: 1.18 },
        { x: 0.01, z: 1.21 }
      ],
      hasLidar: true
    });
    setArWidthCm(String(measured.widthCm));
    setArLengthCm(String(measured.lengthCm));
    setArStatus(
      `Captured ${measured.widthCm}×${measured.lengthCm}cm (${measured.areaSqm}m²) · ${measured.confidenceLabel}. Adjust below if needed.`
    );
  };

  const handleSaveArBed = async () => {
    const widthCm = Math.max(25, Number(arWidthCm) || 120);
    const lengthCm = Math.max(25, Number(arLengthCm) || 240);
    const res = await createGardenZone(profile, {
      id: `zone_ar_${Date.now()}`,
      profileId: profile.id,
      name: arBedName.trim() || 'AR Measured Bed',
      zoneType: 'Raised Bed',
      widthCm,
      lengthCm,
      sunAspect: 'North',
      soilType: 'Loam',
      drainage: 'Moderate',
      rainwaterTankConnected: false
    });
    if (!res.ok) {
      setArStatus('Free tier limit (3 beds) reached — unlock Pro Garden for unlimited beds.');
      return;
    }
    setArStatus(`Saved "${arBedName.trim() || 'AR Measured Bed'}" (${widthCm}×${lengthCm}cm).`);
    await onWorkspaceChanged();
  };

  const handleCloudSync = async () => {
    const { result, updatedProfile } = await syncPendingChangesToCloud({ profile });
    onProfileUpdated(updatedProfile);
    if (result.status === 'nothing-to-sync') {
      setSyncMessage('All local SQLite changes are up to date.');
    } else if (result.status === 'offline-queued') {
      setSyncMessage(
        `${result.pendingCount} local change(s) queued in SQLite — ready to sync when signed in to Pro Cloud.`
      );
    } else {
      setSyncMessage(`Synced ${result.syncedCount} change(s) to Supabase.`);
    }
  };

  const totalHarvestKg = useMemo(
    () =>
      Math.round(
        (harvests.reduce((sum, h) => sum + (h.weightGrams ?? 0), 0) / 1000) * 10
      ) / 10,
    [harvests]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>AI Diagnostics & Biosecurity</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Plant, Pest & NPPA Weed Scanner</Text>
          <Text style={styles.badge}>
            {quota.remainingTotal} scans left ({quota.usedThisMonth}/{quota.monthlyLimit})
          </Text>
        </View>
        <TextInput
          style={styles.input}
          value={diagNotes}
          onChangeText={setDiagNotes}
          placeholder="Describe photo/symptoms (e.g. 'wandering tradescantia' or 'curled tomato leaves')"
          placeholderTextColor="#64748B"
        />
        {diagError && <Text style={styles.errorText}>{diagError}</Text>}
        <View style={styles.rowBetween}>
          <Pressable
            style={[styles.primaryBtn, { flex: 1 }, diagBusy && styles.disabledBtn]}
            onPress={() => void handleRunDiagnosis()}
            disabled={diagBusy}
          >
            <Text style={styles.primaryBtnText}>
              {diagBusy ? 'Analysing...' : 'Run Diagnostic Scan'}
            </Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => void onBuyAiCredits()}>
            <Text style={styles.outlineBtnText}>{AI_PACK_PRICE_NZD}</Text>
          </Pressable>
        </View>

        {diagnoses.slice(0, 3).map((d) => (
          <View key={d.id} style={[styles.subCard, d.isNppaWeed && styles.nppaBox]}>
            <Text style={styles.cardTitle}>
              {d.isNppaWeed ? '⚠️ ' : ''}
              {d.topDiagnosis} ({Math.round(d.confidence * 100)}%)
            </Text>
            {d.treatmentSteps.map((step) => (
              <Text key={step} style={styles.cardText}>
                • {step}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>AR / LiDAR Bed Mapper (Phase 3)</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Measure Bed Footprint</Text>
        <Text style={styles.cardMeta}>
          Capture 4 corners via ARKit/ARCore plane detection or enter/adjust dimensions manually.
        </Text>
        <Pressable style={styles.outlineBtn} onPress={handleSimulateArCapture}>
          <Text style={styles.outlineBtnText}>Capture AR Plane Corners</Text>
        </Pressable>
        {arStatus && <Text style={styles.cardText}>{arStatus}</Text>}
        <TextInput
          style={styles.input}
          value={arBedName}
          onChangeText={setArBedName}
          placeholder="Bed name"
          placeholderTextColor="#64748B"
        />
        <View style={styles.rowBetween}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={arWidthCm}
            onChangeText={setArWidthCm}
            keyboardType="numeric"
            placeholder="Width cm"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={arLengthCm}
            onChangeText={setArLengthCm}
            keyboardType="numeric"
            placeholder="Length cm"
          />
        </View>
        <Pressable style={styles.primaryBtn} onPress={() => void handleSaveArBed()}>
          <Text style={styles.primaryBtnText}>Save Measured Bed</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Harvest & Yield Journal ({totalHarvestKg} kg total)</Text>
      <View style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {edibleSpecies.map((sp) => {
            const active = harvestSpeciesId === sp.id;
            return (
              <Pressable
                key={sp.id}
                onPress={() => setHarvestSpeciesId(sp.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {sp.commonName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.rowBetween}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={quantityLabel}
            onChangeText={setQuantityLabel}
            placeholder="Quantity (e.g. 1.2 kg, 6 lemons)"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={weightGrams}
            onChangeText={setWeightGrams}
            keyboardType="numeric"
            placeholder="Weight (g)"
          />
        </View>
        <TextInput
          style={styles.input}
          value={harvestNotes}
          onChangeText={setHarvestNotes}
          placeholder="Notes (flavour, pest pressure, variety)..."
          placeholderTextColor="#64748B"
        />
        <Pressable style={styles.primaryBtn} onPress={() => void handleLogHarvest()}>
          <Text style={styles.primaryBtnText}>Log Harvest</Text>
        </Pressable>

        {harvests.slice(0, 5).map((h) => {
          const sp = PLANT_SPECIES_BY_ID[h.speciesId];
          const z = zones.find((zone) => zone.id === h.zoneId);
          return (
            <Text key={h.id} style={styles.cardText}>
              • {h.harvestedAtIso}: {sp?.commonName ?? h.speciesId} — {h.quantityLabel}
              {z ? ` (${z.name})` : ''}
            </Text>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Pro Garden & Cloud Backup</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Tier: {profile.isPro ? 'Pro Garden Unlocked ✓' : 'Free Core (Local-First)'}
        </Text>
        <Text style={styles.cardMeta}>
          Pending local sync queue: {pendingSyncCount} item(s)
        </Text>
        {!profile.isPro && (
          <Pressable style={styles.primaryBtn} onPress={() => void onUnlockPro()}>
            <Text style={styles.primaryBtnText}>Unlock Pro Garden · {PRO_GARDEN_PRICE_NZD}</Text>
          </Pressable>
        )}
        <Pressable style={styles.outlineBtn} onPress={() => void handleCloudSync()}>
          <Text style={styles.outlineBtnText}>Sync Local Garden to Cloud</Text>
        </Pressable>
        {syncMessage && <Text style={styles.cardText}>{syncMessage}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  subCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 4
  },
  nppaBox: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#64748B' },
  cardText: { fontSize: 13, color: '#334155', lineHeight: 18 },
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
  primaryBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#166534',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center'
  },
  outlineBtnText: { color: '#166534', fontSize: 12, fontWeight: '700' },
  errorText: { fontSize: 12, color: '#DC2626', fontWeight: '600' }
});
