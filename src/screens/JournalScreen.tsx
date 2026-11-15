import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { getAppEnvConfig } from '../config/env';
import {
  NZ_PLANT_CATALOG,
  PLANT_SPECIES_BY_ID
} from '../data/nzPlantCatalog';
import {
  createGardenZone,
  saveHarvestLog
} from '../db/database';
import {
  getAiQuotaStatus,
  runAiDiagnosticScan
} from '../services/aiDiagnosticsService';
import { measureBedWithAr } from '../services/arBridgeService';
import {
  captureGardenPhoto,
  CapturedPhoto,
  pickGardenPhoto
} from '../services/cameraService';
import {
  AI_PACK_PRICE_NZD,
  PRO_GARDEN_PRICE_NZD,
  restoreProPurchases
} from '../services/monetizationService';
import {
  requestEmailMagicLink,
  syncPendingChangesToCloud
} from '../services/syncService';
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
  focusSection?: 'all' | 'ai' | 'journal';
  onProfileUpdated: (updated: GardenProfile) => void;
  onWorkspaceChanged: () => Promise<void>;
  onUnlockPro: () => Promise<void>;
  onBuyAiCredits: () => Promise<void>;
  onPinCareNote?: (title: string, summary: string) => void;
}

type JournalToolTab = 'harvests' | 'ar' | 'sync';

const SYMPTOM_QUICK_CHIPS = [
  'Curled tomato leaves',
  'Fluffy white nymphs',
  'Wandering willie weed',
  'Powdery white mildew'
] as const;

const QUICK_QUANTITIES = [
  { label: '250g', grams: '250' },
  { label: '500g', grams: '500' },
  { label: '1 kg', grams: '1000' },
  { label: '2 kg', grams: '2000' }
] as const;

const JOURNAL_TOOL_TABS: ReadonlyArray<{ id: JournalToolTab; label: string }> = [
  { id: 'harvests', label: '🌾 Harvests' },
  { id: 'ar', label: '📐 AR Measure' },
  { id: 'sync', label: '☁️ Sync & Pro' }
];

export function JournalScreen({
  profile,
  zones,
  diagnoses,
  harvests,
  pendingSyncCount,
  focusSection = 'all',
  onProfileUpdated,
  onWorkspaceChanged,
  onUnlockPro,
  onBuyAiCredits,
  onPinCareNote
}: Props) {
  // Journal segmented tab state
  const [activeJournalTab, setActiveJournalTab] = useState<JournalToolTab>('harvests');

  // AI Diagnostics state
  const [diagNotes, setDiagNotes] = useState('');
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  // Harvest Log state
  const [harvestZoneId, setHarvestZoneId] = useState(zones[0]?.id ?? '');
  const [harvestSpeciesId, setHarvestSpeciesId] = useState('tomato-beefsteak');
  const [quantityLabel, setQuantityLabel] = useState('1 kg');
  const [weightGrams, setWeightGrams] = useState('1000');
  const [harvestNotes, setHarvestNotes] = useState('');

  // AR Bed Mapper state (with manual dimension fallback)
  const [arBedName, setArBedName] = useState('AR Measured Bed');
  const [arWidthCm, setArWidthCm] = useState('120');
  const [arLengthCm, setArLengthCm] = useState('240');
  const [arStatus, setArStatus] = useState<string | null>(null);

  // Sync status
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [cloudEmail, setCloudEmail] = useState('');
  const [attachedPhoto, setAttachedPhoto] = useState<CapturedPhoto | null>(null);

  const quota = useMemo(() => getAiQuotaStatus(profile), [profile]);
  const quotaPercent = Math.min(
    100,
    Math.round((quota.usedThisMonth / Math.max(1, quota.monthlyLimit)) * 100)
  );
  const quotaBarWidth: `${number}%` = `${quotaPercent}%`;
  const quotaBarColor =
    quota.usedThisMonth >= quota.monthlyLimit
      ? '#DC2626'
      : quotaPercent >= 80
        ? '#D97706'
        : '#16A34A';

  const edibleSpecies = useMemo(
    () =>
      NZ_PLANT_CATALOG.filter(
        (p) => !p.isNppaWeed && (p.category === 'Vegetable' || p.category === 'Fruit & Citrus' || p.category === 'Herb')
      ).slice(0, 18),
    []
  );

  const handleCapturePhoto = async (mode: 'camera' | 'gallery') => {
    setDiagError(null);
    const res = mode === 'camera' ? await captureGardenPhoto() : await pickGardenPhoto();
    if (res.error) {
      setDiagError(res.error);
      return;
    }
    if (res.photo) {
      setAttachedPhoto(res.photo);
    }
  };

  const handleRunDiagnosis = async (overrideNotes?: string) => {
    setDiagError(null);
    const trimmed = (overrideNotes ?? diagNotes).trim();
    if (!trimmed && !attachedPhoto) {
      setDiagError('Describe the leaf symptoms or attach a photo first.');
      return;
    }
    if (overrideNotes !== undefined) {
      setDiagNotes(trimmed);
    }
    setDiagBusy(true);
    try {
      const env = getAppEnvConfig();
      const { updatedProfile } = await runAiDiagnosticScan({
        profile,
        zoneId: zones[0]?.id,
        queryNotes: trimmed || 'Photo scan',
        imageBase64: attachedPhoto?.base64,
        supabaseEdgeUrl: env.supabaseUrl || undefined,
        supabaseAnonKey: env.supabaseAnonKey || undefined
      });
      onProfileUpdated(updatedProfile);
      setDiagNotes('');
      setAttachedPhoto(null);
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

  const handleSimulateArCapture = async () => {
    const { measurement, source } = await measureBedWithAr();
    setArWidthCm(String(measurement.widthCm));
    setArLengthCm(String(measurement.lengthCm));
    setArStatus(
      `Captured ${measurement.widthCm}×${measurement.lengthCm}cm (${measurement.areaSqm}m²) · ${measurement.confidenceLabel} (${source === 'native-ar' ? 'ARKit/ARCore' : 'Calibrated fallback'}). Adjust below if needed.`
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

  const [pinnedDiagnosisIds, setPinnedDiagnosisIds] = useState<Record<string, boolean>>({});

  const totalHarvestKg = useMemo(
    () =>
      Math.round(
        (harvests.reduce((sum, h) => sum + (h.weightGrams ?? 0), 0) / 1000) * 10
      ) / 10,
    [harvests]
  );

  const harvestTotalsByCrop = useMemo(() => {
    const map: Record<string, { name: string; grams: number }> = {};
    for (const h of harvests) {
      const name = PLANT_SPECIES_BY_ID[h.speciesId]?.commonName ?? h.speciesId;
      const existing = map[h.speciesId];
      map[h.speciesId] = {
        name,
        grams: (existing?.grams ?? 0) + (h.weightGrams ?? 0)
      };
    }
    const list = Object.values(map).sort((a, b) => b.grams - a.grams).slice(0, 4);
    const maxGrams = Math.max(1, list[0]?.grams ?? 1);
    return list.map((item) => ({
      ...item,
      pct: Math.max(10, Math.round((item.grams / maxGrams) * 100)) as number
    }));
  }, [harvests]);

  const showAi = focusSection === 'all' || focusSection === 'ai';
  const showJournal = focusSection === 'all' || focusSection === 'journal';

  return (
    <View style={styles.container}>
      {showAi && (
        <>
          <Text style={styles.sectionTitle}>AI Diagnostics & Biosecurity</Text>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Plant, Pest & NPPA Weed Scanner</Text>
              <View style={styles.quotaBadgePill}>
                <Text style={styles.badge}>
                  {quota.remainingTotal} left
                </Text>
              </View>
            </View>

            <View style={styles.quotaSection}>
              <View style={styles.rowBetween}>
                <Text style={styles.quotaLabel}>
                  Monthly scans: {quota.usedThisMonth} / {quota.monthlyLimit}
                </Text>
                <Text style={styles.quotaBonusText}>
                  +{quota.bonusCredits} bonus {quota.bonusCredits === 1 ? 'credit' : 'credits'}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: quotaBarWidth, backgroundColor: quotaBarColor }
                  ]}
                />
              </View>
            </View>

            <Text style={styles.subLabel}>1-tap test symptoms</Text>
            <View style={styles.wrapChips}>
              {SYMPTOM_QUICK_CHIPS.map((symptom) => {
                const active = diagNotes.trim().toLowerCase() === symptom.toLowerCase();
                return (
                  <Pressable
                    key={symptom}
                    onPress={() => void handleRunDiagnosis(symptom)}
                    disabled={diagBusy}
                    style={[
                      styles.quickChip,
                      active && styles.chipActive,
                      diagBusy && styles.disabledBtn
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      ⚡ {symptom}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rowBetween}>
              <Pressable
                style={[styles.outlineBtn, { flex: 1 }]}
                onPress={() => void handleCapturePhoto('camera')}
                disabled={diagBusy}
              >
                <Text style={styles.outlineBtnText}>📷 Take Photo</Text>
              </Pressable>
              <Pressable
                style={[styles.outlineBtn, { flex: 1 }]}
                onPress={() => void handleCapturePhoto('gallery')}
                disabled={diagBusy}
              >
                <Text style={styles.outlineBtnText}>🖼️ Choose Photo</Text>
              </Pressable>
            </View>

            {attachedPhoto && (
              <View style={styles.photoPreviewRow}>
                <Image source={{ uri: attachedPhoto.uri }} style={styles.photoThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.badge}>Photo ready for Vision AI</Text>
                  <Text style={styles.cardMeta}>
                    {attachedPhoto.width}×{attachedPhoto.height} px
                  </Text>
                </View>
                <Pressable onPress={() => setAttachedPhoto(null)}>
                  <Text style={styles.cardMeta}>Clear</Text>
                </Pressable>
              </View>
            )}

            <TextInput
              style={styles.input}
              value={diagNotes}
              onChangeText={setDiagNotes}
              placeholder="Or describe photo/symptoms (e.g. 'wandering tradescantia')"
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

            {diagnoses.slice(0, 3).map((d) => {
              const pinned = Boolean(pinnedDiagnosisIds[d.id]);
              return (
                <View key={d.id} style={[styles.subCard, d.isNppaWeed && styles.nppaBox]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardTitle, { flex: 1 }]}>
                      {d.isNppaWeed ? '⚠️ ' : ''}
                      {d.topDiagnosis} ({Math.round(d.confidence * 100)}%)
                    </Text>
                    {onPinCareNote && (
                      <Pressable
                        onPress={() => {
                          if (pinned) return;
                          onPinCareNote(
                            `Action: ${d.topDiagnosis}`,
                            d.treatmentSteps[0] ?? d.nppaGuidance ?? 'Inspect affected plants.'
                          );
                          setPinnedDiagnosisIds((prev) => ({ ...prev, [d.id]: true }));
                        }}
                        style={styles.pinBtn}
                      >
                        <Text style={styles.pinBtnText}>{pinned ? '✓ Pinned' : '📌 Pin to Today'}</Text>
                      </Pressable>
                    )}
                  </View>
                  {d.treatmentSteps.map((step) => (
                    <Text key={step} style={styles.cardText}>
                      • {step}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        </>
      )}

      {showJournal && (
        <>
          <View style={styles.segmentedBar}>
            {JOURNAL_TOOL_TABS.map((tab) => {
              const active = activeJournalTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveJournalTab(tab.id)}
                  style={[styles.segmentedPill, active && styles.segmentedPillActive]}
                >
                  <Text
                    style={[
                      styles.segmentedPillText,
                      active && styles.segmentedPillTextActive
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {activeJournalTab === 'harvests' && (
            <>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Harvest & Yield Journal</Text>
                <View style={styles.totalPill}>
                  <Text style={styles.totalPillText}>{totalHarvestKg} kg total</Text>
                </View>
              </View>
              <View style={styles.card}>
                <Text style={styles.subLabel}>Crop</Text>
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

                <Text style={styles.subLabel}>Quick quantity</Text>
                <View style={styles.wrapChips}>
                  {QUICK_QUANTITIES.map((q) => {
                    const active =
                      quantityLabel.trim() === q.label && weightGrams.trim() === q.grams;
                    return (
                      <Pressable
                        key={q.label}
                        onPress={() => {
                          setQuantityLabel(q.label);
                          setWeightGrams(q.grams);
                        }}
                        style={[styles.quickChip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {q.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.rowBetween}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={quantityLabel}
                    onChangeText={setQuantityLabel}
                    placeholder="Quantity (e.g. 1.2 kg, 6 lemons)"
                    placeholderTextColor="#64748B"
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={weightGrams}
                    onChangeText={setWeightGrams}
                    keyboardType="numeric"
                    placeholder="Weight (g)"
                    placeholderTextColor="#64748B"
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

                {harvestTotalsByCrop.length > 0 && (
                  <View style={styles.yieldBarsCard}>
                    <Text style={styles.subLabel}>Top Crop Yields</Text>
                    {harvestTotalsByCrop.map((item) => (
                      <View key={item.name} style={styles.yieldBarRow}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.yieldBarName}>{item.name}</Text>
                          <Text style={styles.cardMeta}>
                            {item.grams >= 1000
                              ? `${(item.grams / 1000).toFixed(1)} kg`
                              : `${item.grams} g`}
                          </Text>
                        </View>
                        <View style={styles.yieldBarTrack}>
                          <View
                            style={[
                              styles.yieldBarFill,
                              { width: `${item.pct}%` as `${number}%` }
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {harvests.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>🌾</Text>
                    <Text style={styles.emptyStateTitle}>No harvests logged yet</Text>
                    <Text style={styles.emptyStateText}>
                      Select a crop above, tap a quick weight, and record your first garden yield.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.harvestList}>
                    {harvests.slice(0, 5).map((h) => {
                      const sp = PLANT_SPECIES_BY_ID[h.speciesId];
                      const z = zones.find((zone) => zone.id === h.zoneId);
                      return (
                        <View key={h.id} style={styles.subCard}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.cardTitle}>
                              {sp?.commonName ?? h.speciesId} · {h.quantityLabel}
                            </Text>
                            <Text style={styles.cardMeta}>{h.harvestedAtIso}</Text>
                          </View>
                          {(z || h.notes) && (
                            <Text style={styles.cardMeta}>
                              {z ? z.name : ''}
                              {z && h.notes ? ' — ' : ''}
                              {h.notes ?? ''}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}

          {activeJournalTab === 'ar' && (
            <>
              <Text style={styles.sectionTitle}>AR / LiDAR Bed Mapper</Text>
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
                    placeholderTextColor="#64748B"
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={arLengthCm}
                    onChangeText={setArLengthCm}
                    keyboardType="numeric"
                    placeholder="Length cm"
                    placeholderTextColor="#64748B"
                  />
                </View>

                {(() => {
                  const w = Math.max(30, Number(arWidthCm) || 120);
                  const l = Math.max(30, Number(arLengthCm) || 240);
                  const maxSide = Math.max(w, l);
                  const boxW = Math.max(56, Math.round((w / maxSide) * 140));
                  const boxH = Math.max(44, Math.round((l / maxSide) * 110));
                  const areaSqm = ((w / 100) * (l / 100)).toFixed(2);
                  return (
                    <View style={styles.arWireframeWrap}>
                      <View style={[styles.arWireframeBox, { width: boxW, height: boxH }]}>
                        <Text style={styles.arWireframeDim}>
                          {w} × {l} cm
                        </Text>
                        <Text style={styles.arWireframeArea}>{areaSqm} m²</Text>
                      </View>
                    </View>
                  );
                })()}

                <Pressable style={styles.primaryBtn} onPress={() => void handleSaveArBed()}>
                  <Text style={styles.primaryBtnText}>Save Measured Bed</Text>
                </Pressable>
              </View>
            </>
          )}

          {activeJournalTab === 'sync' && (
            <>
              <Text style={styles.sectionTitle}>Pro Garden & Cloud Backup</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Tier: {profile.isPro ? 'Pro Garden Unlocked ✓' : 'Free Core (Local-First)'}
                </Text>
                <Text style={styles.cardMeta}>
                  Pending local sync queue: {pendingSyncCount} item(s)
                </Text>
                {!profile.isPro && (
                  <View style={styles.rowBetween}>
                    <Pressable
                      style={[styles.primaryBtn, { flex: 1 }]}
                      onPress={() => void onUnlockPro()}
                    >
                      <Text style={styles.primaryBtnText}>
                        Unlock Pro · {PRO_GARDEN_PRICE_NZD}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.outlineBtn}
                      onPress={async () => {
                        const res = await restoreProPurchases(profile);
                        onProfileUpdated(res.updatedProfile);
                        setSyncMessage(
                          res.restored
                            ? 'Pro Garden purchase restored ✓'
                            : 'No previous Pro Garden purchase found for this account.'
                        );
                      }}
                    >
                      <Text style={styles.outlineBtnText}>Restore</Text>
                    </Pressable>
                  </View>
                )}

                <Text style={styles.subLabel}>Optional Cloud Account (Supabase)</Text>
                <View style={styles.rowBetween}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={cloudEmail}
                    onChangeText={setCloudEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="Email for magic-link backup..."
                    placeholderTextColor="#64748B"
                  />
                  <Pressable
                    style={styles.outlineBtn}
                    onPress={async () => {
                      if (!cloudEmail.trim()) {
                        setSyncMessage('Enter an email address first.');
                        return;
                      }
                      const res = await requestEmailMagicLink(cloudEmail);
                      setSyncMessage(res.message);
                    }}
                  >
                    <Text style={styles.outlineBtnText}>Send Link</Text>
                  </Pressable>
                </View>

                <Pressable style={styles.outlineBtn} onPress={() => void handleCloudSync()}>
                  <Text style={styles.outlineBtnText}>Sync Local Garden to Cloud</Text>
                </Pressable>
                {syncMessage && <Text style={styles.cardText}>{syncMessage}</Text>}
              </View>
            </>
          )}
        </>
      )}
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
    gap: 10
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
  quotaBadgePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  badge: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  quotaSection: { gap: 5 },
  quotaLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },
  quotaBonusText: { fontSize: 11, fontWeight: '700', color: '#0369A1' },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999
  },
  subLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    padding: 4,
    gap: 4
  },
  segmentedPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentedPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2
  },
  segmentedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  segmentedPillTextActive: {
    color: '#166534'
  },
  totalPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  totalPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534'
  },
  harvestList: { gap: 8 },
  emptyState: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4
  },
  emptyStateIcon: { fontSize: 24 },
  emptyStateTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  emptyStateText: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 17 },
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
  errorText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 8
  },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#DCFCE7'
  },
  pinBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  pinBtnText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  yieldBarsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  yieldBarRow: { gap: 4 },
  yieldBarName: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  yieldBarTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden'
  },
  yieldBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#16A34A'
  },
  arWireframeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  arWireframeBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#15803D',
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6
  },
  arWireframeDim: { fontSize: 11, fontWeight: '800', color: '#14532D' },
  arWireframeArea: { fontSize: 10, fontWeight: '700', color: '#15803D', marginTop: 2 }
});
