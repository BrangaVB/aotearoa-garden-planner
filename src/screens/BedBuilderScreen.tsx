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
  NZ_PLANT_CATALOG,
  PLANT_SPECIES_BY_ID,
  searchPlantCatalog
} from '../data/nzPlantCatalog';
import {
  createGardenZone,
  deleteGardenZone,
  FREE_TIER_MAX_ZONES,
  removePlanting,
  upsertPlanting
} from '../db/database';
import {
  getZoneGridDimensions,
  PlacementValidationResult,
  validatePlantingPlacement
} from '../engine/bedPlannerEngine';
import {
  GardenProfile,
  GardenZone,
  Planting,
  PlantSpecies,
  SoilType,
  SunAspect,
  ZoneType
} from '../types/domain';

interface Props {
  profile: GardenProfile;
  zones: GardenZone[];
  plantingsByZone: Record<string, Planting[]>;
  onWorkspaceChanged: () => Promise<void>;
}

const ZONE_TYPES: ZoneType[] = [
  'Raised Bed',
  'In-Ground Bed',
  'Patio Pots',
  'Orchard Strip',
  'Native Border'
];
const SUN_ASPECTS: SunAspect[] = ['North', 'North-East', 'North-West', 'East', 'West', 'South'];
const SOIL_TYPES: SoilType[] = ['Loam', 'Clay', 'Sandy', 'Volcanic/Pumice', 'Potting Mix'];

export function BedBuilderScreen({
  profile,
  zones,
  plantingsByZone,
  onWorkspaceChanged
}: Props) {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.id ?? '');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // New bed form state
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('Raised Bed');
  const [widthCm, setWidthCm] = useState('100');
  const [lengthCm, setLengthCm] = useState('200');
  const [sunAspect, setSunAspect] = useState<SunAspect>('North');
  const [soilType, setSoilType] = useState<SoilType>('Loam');
  const [rainwaterTankConnected, setRainwaterTankConnected] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Plant picker & grid placement state
  const [plantQuery, setPlantQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<PlantSpecies | null>(
    NZ_PLANT_CATALOG[0] ?? null
  );
  const [pendingCell, setPendingCell] = useState<{ row: number; col: number } | null>(null);
  const [validation, setValidation] = useState<PlacementValidationResult | null>(null);

  const filteredSpecies = useMemo(
    () => searchPlantCatalog(plantQuery).slice(0, 20),
    [plantQuery]
  );

  const activeZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) ?? zones[0],
    [zones, selectedZoneId]
  );

  const activePlantings = useMemo(
    () => (activeZone ? plantingsByZone[activeZone.id] ?? [] : []),
    [activeZone, plantingsByZone]
  );

  const grid = useMemo(
    () => (activeZone ? getZoneGridDimensions(activeZone, 25) : null),
    [activeZone]
  );

  const existingOccupantAtPending = useMemo(() => {
    if (!pendingCell) return undefined;
    return activePlantings.find(
      (p) => p.gridRow === pendingCell.row && p.gridCol === pendingCell.col
    );
  }, [activePlantings, pendingCell]);

  const handleCreateZone = async () => {
    setFormError(null);
    const trimmedName = name.trim();
    const parsedWidth = Number(widthCm);
    const parsedLength = Number(lengthCm);

    if (!trimmedName) {
      setFormError('Please enter a name for this garden bed or zone.');
      return;
    }
    if (!Number.isFinite(parsedWidth) || parsedWidth < 25 || !Number.isFinite(parsedLength) || parsedLength < 25) {
      setFormError('Width and length must be at least 25 cm.');
      return;
    }

    const newZone: GardenZone = {
      id: `zone_${Date.now()}`,
      profileId: profile.id,
      name: trimmedName,
      zoneType,
      widthCm: parsedWidth,
      lengthCm: parsedLength,
      sunAspect,
      soilType,
      drainage: soilType === 'Sandy' || soilType === 'Potting Mix' ? 'Fast' : soilType === 'Clay' ? 'Poor' : 'Moderate',
      rainwaterTankConnected
    };

    const result = await createGardenZone(profile, newZone);
    if (!result.ok) {
      setFormError(
        `Free tier supports up to ${FREE_TIER_MAX_ZONES} beds/zones. Upgrade to Pro Garden for unlimited beds.`
      );
      return;
    }

    setName('');
    setShowCreateForm(false);
    setSelectedZoneId(newZone.id);
    await onWorkspaceChanged();
  };

  const handleDeleteActiveZone = async () => {
    if (!activeZone) return;
    await deleteGardenZone(activeZone.id);
    setPendingCell(null);
    setValidation(null);
    setSelectedZoneId('');
    await onWorkspaceChanged();
  };

  const handleCellPress = (row: number, col: number) => {
    if (!activeZone || !selectedSpecies) return;
    const result = validatePlantingPlacement({
      zone: activeZone,
      candidateSpecies: selectedSpecies,
      targetRow: row,
      targetCol: col,
      existingPlantings: activePlantings,
      cellSizeCm: 25
    });
    setPendingCell({ row, col });
    setValidation(result);
  };

  const handleConfirmPlanting = async () => {
    if (!activeZone || !selectedSpecies || !pendingCell || !validation?.allowed) return;
    await upsertPlanting({
      id: existingOccupantAtPending?.id ?? `plant_${Date.now()}_${pendingCell.row}_${pendingCell.col}`,
      zoneId: activeZone.id,
      speciesId: selectedSpecies.id,
      plantedDateIso: new Date().toISOString().slice(0, 10),
      growthStage: 'Seedling',
      gridRow: pendingCell.row,
      gridCol: pendingCell.col,
      moistureDeficitMm: existingOccupantAtPending?.moistureDeficitMm ?? 0,
      lastWateredIso: existingOccupantAtPending?.lastWateredIso
    });
    setPendingCell(null);
    setValidation(null);
    await onWorkspaceChanged();
  };

  const handleRemovePlanting = async (plantingId: string) => {
    await removePlanting(plantingId);
    setPendingCell(null);
    setValidation(null);
    await onWorkspaceChanged();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          Garden Beds & Zones ({zones.length}/{profile.isPro ? '∞' : FREE_TIER_MAX_ZONES} Free)
        </Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            setFormError(null);
            setShowCreateForm((prev) => !prev);
          }}
        >
          <Text style={styles.addBtnText}>{showCreateForm ? 'Cancel' : '+ New Bed'}</Text>
        </Pressable>
      </View>

      {showCreateForm && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Modular Bed / Zone</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Bed name (e.g. Patio Pots, Vege Bed 2)"
            placeholderTextColor="#64748B"
          />

          <Text style={styles.label}>Zone Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {ZONE_TYPES.map((zt) => (
              <Pressable
                key={zt}
                onPress={() => setZoneType(zt)}
                style={[styles.chip, zoneType === zt && styles.chipActive]}
              >
                <Text style={[styles.chipText, zoneType === zt && styles.chipTextActive]}>{zt}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <Text style={styles.label}>Width (cm)</Text>
              <TextInput
                style={styles.input}
                value={widthCm}
                onChangeText={setWidthCm}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.dimCol}>
              <Text style={styles.label}>Length (cm)</Text>
              <TextInput
                style={styles.input}
                value={lengthCm}
                onChangeText={setLengthCm}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.label}>Sun Aspect (Southern Hemisphere)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {SUN_ASPECTS.map((aspect) => (
              <Pressable
                key={aspect}
                onPress={() => setSunAspect(aspect)}
                style={[styles.chip, sunAspect === aspect && styles.chipActive]}
              >
                <Text style={[styles.chipText, sunAspect === aspect && styles.chipTextActive]}>
                  {aspect}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Soil Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {SOIL_TYPES.map((soil) => (
              <Pressable
                key={soil}
                onPress={() => setSoilType(soil)}
                style={[styles.chip, soilType === soil && styles.chipActive]}
              >
                <Text style={[styles.chipText, soilType === soil && styles.chipTextActive]}>
                  {soil}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Rainwater Tank Connected</Text>
            <Switch value={rainwaterTankConnected} onValueChange={setRainwaterTankConnected} />
          </View>

          {formError && <Text style={styles.errorText}>{formError}</Text>}

          <Pressable style={styles.primaryBtn} onPress={handleCreateZone}>
            <Text style={styles.primaryBtnText}>Save Bed / Zone</Text>
          </Pressable>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {zones.map((z) => {
          const active = activeZone?.id === z.id;
          return (
            <Pressable
              key={z.id}
              onPress={() => {
                setSelectedZoneId(z.id);
                setPendingCell(null);
                setValidation(null);
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{z.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeZone && grid && (
        <View style={styles.card}>
          <View style={styles.zoneHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{activeZone.name}</Text>
              <Text style={styles.cardMeta}>
                {activeZone.zoneType} · {activeZone.widthCm}×{activeZone.lengthCm}cm ·{' '}
                {activeZone.sunAspect}-facing · {activeZone.soilType}
                {activeZone.rainwaterTankConnected ? ' · Rainwater Tank' : ''}
              </Text>
            </View>
            {zones.length > 1 && (
              <Pressable style={styles.deleteBtn} onPress={handleDeleteActiveZone}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.label}>1. Search & Select Plant (25cm Grid)</Text>
          <TextInput
            style={styles.input}
            value={plantQuery}
            onChangeText={setPlantQuery}
            placeholder="Filter plants (e.g. tomato, kūmara, kōwhai, feijoa)..."
            placeholderTextColor="#64748B"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {filteredSpecies.map((sp) => {
              const active = selectedSpecies?.id === sp.id;
              return (
                <Pressable
                  key={sp.id}
                  onPress={() => {
                    setSelectedSpecies(sp);
                    setPendingCell(null);
                    setValidation(null);
                  }}
                  style={[
                    styles.chip,
                    sp.isNppaWeed && styles.nppaChip,
                    active && styles.chipActive
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {sp.isNppaWeed ? '⚠️ ' : ''}
                    {sp.commonName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>2. Tap a Grid Cell ({grid.rows}×{grid.cols})</Text>
          <View style={styles.gridWrap}>
            {Array.from({ length: Math.min(grid.rows, 6) }).map((_, rIdx) => (
              <View key={rIdx} style={styles.gridRow}>
                {Array.from({ length: Math.min(grid.cols, 8) }).map((__, cIdx) => {
                  const occupant = activePlantings.find(
                    (p) => p.gridRow === rIdx && p.gridCol === cIdx
                  );
                  const occupantSpecies = occupant
                    ? PLANT_SPECIES_BY_ID[occupant.speciesId]
                    : undefined;
                  const isSelected =
                    pendingCell?.row === rIdx && pendingCell?.col === cIdx;

                  return (
                    <Pressable
                      key={`${rIdx}_${cIdx}`}
                      onPress={() => handleCellPress(rIdx, cIdx)}
                      style={[
                        styles.gridCell,
                        occupantSpecies && styles.gridCellOccupied,
                        isSelected && styles.gridCellSelected
                      ]}
                    >
                      <Text style={styles.gridCellText} numberOfLines={2}>
                        {occupantSpecies
                          ? occupantSpecies.commonName.slice(0, 8)
                          : `${rIdx},${cIdx}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {validation && pendingCell && (
            <View style={[styles.validationBox, !validation.allowed && styles.validationErrorBox]}>
              {!validation.allowed ? (
                <Text style={styles.errorText}>⛔ {validation.biosecurityBlock}</Text>
              ) : (
                <>
                  <Text style={styles.validationTitle}>
                    Place {selectedSpecies?.commonName} at ({pendingCell.row}, {pendingCell.col})
                  </Text>
                  {validation.companionHighlights.map((msg) => (
                    <Text key={msg} style={styles.companionText}>
                      ✅ {msg}
                    </Text>
                  ))}
                  {validation.spacingWarnings.map((msg) => (
                    <Text key={msg} style={styles.warningText}>
                      ⚠️ {msg}
                    </Text>
                  ))}
                  {validation.antagonistWarnings.map((msg) => (
                    <Text key={msg} style={styles.warningText}>
                      ⚠️ {msg}
                    </Text>
                  ))}
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.primaryBtn, { flex: 1 }]}
                      onPress={handleConfirmPlanting}
                    >
                      <Text style={styles.primaryBtnText}>
                        {existingOccupantAtPending ? 'Replace Planting' : 'Confirm Planting'}
                      </Text>
                    </Pressable>
                    {existingOccupantAtPending && (
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => handleRemovePlanting(existingOccupantAtPending.id)}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

          <Text style={styles.label}>Current Plantings ({activePlantings.length})</Text>
          {activePlantings.map((p) => {
            const sp = PLANT_SPECIES_BY_ID[p.speciesId];
            return (
              <View key={p.id} style={styles.plantingRow}>
                <Text style={[styles.cardText, { flex: 1 }]}>
                  • [{p.gridRow},{p.gridCol}] {sp?.commonName ?? p.speciesId}
                  {sp?.teReoName ? ` (${sp.teReoName})` : ''} — Deficit {p.moistureDeficitMm}mm
                </Text>
                <Pressable onPress={() => handleRemovePlanting(p.id)}>
                  <Text style={styles.removeLink}>Remove</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  addBtn: {
    backgroundColor: '#166534',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  deleteBtnText: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#64748B' },
  cardText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 4 },
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
  dimRow: { flexDirection: 'row', gap: 10 },
  dimCol: { flex: 1, gap: 4 },
  chipScroll: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8
  },
  nppaChip: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  chipActive: { backgroundColor: '#166534', borderColor: '#166534' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  primaryBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  removeBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 4
  },
  removeBtnText: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  plantingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeLink: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  gridWrap: { gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  gridCell: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2
  },
  gridCellOccupied: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  gridCellSelected: { borderWidth: 2, borderColor: '#1D4ED8' },
  gridCellText: { fontSize: 9, color: '#0F172A', textAlign: 'center', fontWeight: '600' },
  validationBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 4
  },
  validationErrorBox: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  validationTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  companionText: { fontSize: 12, color: '#15803D', fontWeight: '600' },
  warningText: { fontSize: 12, color: '#B45309', fontWeight: '600' },
  errorText: { fontSize: 12, color: '#DC2626', fontWeight: '600' }
});
