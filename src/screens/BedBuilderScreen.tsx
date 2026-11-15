import React, { useEffect, useMemo, useState } from 'react';
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
  PlantCategory,
  Planting,
  PlantSpecies,
  RotationHistoryEntry,
  SoilType,
  SunAspect,
  ZoneType
} from '../types/domain';

interface Props {
  profile: GardenProfile;
  zones: GardenZone[];
  plantingsByZone: Record<string, Planting[]>;
  rotationHistoryByZone?: Record<string, RotationHistoryEntry[]>;
  selectedZoneId?: string;
  initialSpeciesId?: string;
  onSelectZoneId?: (zoneId: string) => void;
  onWorkspaceChanged: () => Promise<void>;
}

interface BedPreset {
  id: string;
  label: string;
  subtitle: string;
  emoji: string;
  defaultName: string;
  zoneType: ZoneType;
  widthCm: number;
  lengthCm: number;
  soilType: SoilType;
}

const BED_PRESETS: BedPreset[] = [
  {
    id: 'raised-120x240',
    label: 'Raised 120×240',
    subtitle: '4×9 grid · Classic vege bed',
    emoji: '🪵',
    defaultName: 'Raised Vege Bed',
    zoneType: 'Raised Bed',
    widthCm: 120,
    lengthCm: 240,
    soilType: 'Loam'
  },
  {
    id: 'patio-50x150',
    label: 'Patio Pots 50×150',
    subtitle: '2×6 grid · Deck & courtyard',
    emoji: '🪴',
    defaultName: 'Patio Pots',
    zoneType: 'Patio Pots',
    widthCm: 50,
    lengthCm: 150,
    soilType: 'Potting Mix'
  },
  {
    id: 'herb-60x180',
    label: 'Herb Strip 60×180',
    subtitle: '2×7 grid · Kitchen border',
    emoji: '🌿',
    defaultName: 'Herb Strip',
    zoneType: 'In-Ground Bed',
    widthCm: 60,
    lengthCm: 180,
    soilType: 'Loam'
  }
];

const CATEGORY_FILTERS: Array<{ label: string; value?: PlantCategory }> = [
  { label: 'All', value: undefined },
  { label: 'Vegetable', value: 'Vegetable' },
  { label: 'Herb', value: 'Herb' },
  { label: 'Fruit & Citrus', value: 'Fruit & Citrus' },
  { label: 'NZ Native', value: 'NZ Native' },
  { label: 'NPPA Weed', value: 'NPPA Weed' }
];

const ZONE_TYPES: ZoneType[] = [
  'Raised Bed',
  'In-Ground Bed',
  'Patio Pots',
  'Orchard Strip',
  'Native Border'
];
const SUN_ASPECTS: SunAspect[] = ['North', 'North-East', 'North-West', 'East', 'West', 'South'];
const SOIL_TYPES: SoilType[] = ['Loam', 'Clay', 'Sandy', 'Volcanic/Pumice', 'Potting Mix'];

interface SpeciesVisual {
  emoji: string;
  shortCode: string;
  bg: string;
  border: string;
  text: string;
}

const CATEGORY_COLORS: Record<PlantCategory, { bg: string; border: string; text: string }> = {
  Vegetable: { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' },
  Herb: { bg: '#CCFBF1', border: '#0D9488', text: '#134E4A' },
  'Fruit & Citrus': { bg: '#FEF3C7', border: '#D97706', text: '#78350F' },
  'NZ Native': { bg: '#D1FAE5', border: '#059669', text: '#064E3B' },
  Ornamental: { bg: '#FCE7F3', border: '#DB2777', text: '#831843' },
  'NPPA Weed': { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D' }
};

function getSpeciesEmoji(species: PlantSpecies): string {
  const id = species.id.toLowerCase();
  const name = species.commonName.toLowerCase();

  if (species.isNppaWeed || species.category === 'NPPA Weed') return '⛔';
  if (id.includes('tomato') || name.includes('tomato')) return '🍅';
  if (id.includes('potato') || id.includes('taewa')) return '🥔';
  if (id.includes('kumara')) return '🍠';
  if (id.includes('carrot')) return '🥕';
  if (id.includes('capsicum')) return '🫑';
  if (id.includes('chilli')) return '🌶️';
  if (id.includes('eggplant')) return '🍆';
  if (id.includes('broccoli')) return '🥦';
  if (id.includes('corn') || id.includes('maize')) return '🌽';
  if (id.includes('onion') || id.includes('leek') || id.includes('shallot')) return '🧅';
  if (id.includes('garlic')) return '🧄';
  if (id.includes('pumpkin') || id.includes('squash') || id.includes('kamokamo')) return '🎃';
  if (id.includes('cucumber') || id.includes('courgette') || id.includes('zucchini')) return '🥒';
  if (id.includes('bean') || id.includes('pea')) return '🫛';
  if (
    id.includes('lettuce') ||
    id.includes('spinach') ||
    id.includes('silverbeet') ||
    id.includes('kale') ||
    id.includes('cabbage') ||
    id.includes('bok-choy') ||
    id.includes('rocket') ||
    id.includes('puha')
  ) {
    return '🥬';
  }
  if (id.includes('strawberry')) return '🍓';
  if (id.includes('blueberry')) return '🫐';
  if (id.includes('lemon') || id.includes('lime')) return '🍋';
  if (id.includes('mandarin') || id.includes('orange') || id.includes('tangerine')) return '🍊';
  if (id.includes('apple')) return '🍎';
  if (id.includes('pear')) return '🍐';
  if (id.includes('peach') || id.includes('plum') || id.includes('nectarine')) return '🍑';
  if (id.includes('avocado')) return '🥑';
  if (id.includes('feijoa') || id.includes('kiwi')) return '🥝';
  if (species.category === 'Herb') return '🌿';
  if (species.category === 'Fruit & Citrus') return '🍊';
  if (species.category === 'NZ Native') return '🪴';
  if (species.category === 'Ornamental') return '🌼';
  return '🌱';
}

function getSpeciesShortCode(species: PlantSpecies): string {
  const cleaned = species.commonName
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const first = words[0] ?? 'PLT';
  const second = words[1];
  if (second && first.length <= 2) {
    return `${first}${second.slice(0, 2)}`.toUpperCase();
  }
  return first.slice(0, 4).toUpperCase();
}

function getSpeciesVisual(species: PlantSpecies): SpeciesVisual {
  const colors = CATEGORY_COLORS[species.category];
  return {
    emoji: getSpeciesEmoji(species),
    shortCode: getSpeciesShortCode(species),
    bg: colors.bg,
    border: colors.border,
    text: colors.text
  };
}

export function BedBuilderScreen({
  profile,
  zones,
  plantingsByZone,
  rotationHistoryByZone = {},
  selectedZoneId: controlledZoneId,
  initialSpeciesId,
  onSelectZoneId,
  onWorkspaceChanged
}: Props) {
  const [localZoneId, setLocalZoneId] = useState<string>(zones[0]?.id ?? '');
  const effectiveZoneId = controlledZoneId || localZoneId;
  const setSelectedZoneId = (id: string) => {
    setLocalZoneId(id);
    onSelectZoneId?.(id);
  };
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPlantPicker, setShowPlantPicker] = useState(false);
  const [quickPaintMode, setQuickPaintMode] = useState(false);

  // Quick-start preset & custom bed form state
  const [selectedPresetId, setSelectedPresetId] = useState<string>(BED_PRESETS[0]?.id ?? 'raised-120x240');
  const [name, setName] = useState(BED_PRESETS[0]?.defaultName ?? 'Raised Vege Bed');
  const [zoneType, setZoneType] = useState<ZoneType>(BED_PRESETS[0]?.zoneType ?? 'Raised Bed');
  const [widthCm, setWidthCm] = useState(String(BED_PRESETS[0]?.widthCm ?? 120));
  const [lengthCm, setLengthCm] = useState(String(BED_PRESETS[0]?.lengthCm ?? 240));
  const [sunAspect, setSunAspect] = useState<SunAspect>('North');
  const [soilType, setSoilType] = useState<SoilType>(BED_PRESETS[0]?.soilType ?? 'Loam');
  const [rainwaterTankConnected, setRainwaterTankConnected] = useState(false);
  const [showAdvancedBedOptions, setShowAdvancedBedOptions] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Plant picker & grid placement state
  const [plantQuery, setPlantQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PlantCategory | undefined>(undefined);
  const [selectedSpecies, setSelectedSpecies] = useState<PlantSpecies | null>(
    (initialSpeciesId ? PLANT_SPECIES_BY_ID[initialSpeciesId] : undefined) ?? NZ_PLANT_CATALOG[0] ?? null
  );
  const [pendingCell, setPendingCell] = useState<{ row: number; col: number } | null>(null);
  const [validation, setValidation] = useState<PlacementValidationResult | null>(null);

  useEffect(() => {
    if (initialSpeciesId && PLANT_SPECIES_BY_ID[initialSpeciesId]) {
      setSelectedSpecies(PLANT_SPECIES_BY_ID[initialSpeciesId] ?? null);
      setPendingCell(null);
      setValidation(null);
    }
  }, [initialSpeciesId]);

  const filteredSpecies = useMemo(
    () => searchPlantCatalog(plantQuery, selectedCategory).slice(0, 24),
    [plantQuery, selectedCategory]
  );

  const activeZone = useMemo(
    () => zones.find((z) => z.id === effectiveZoneId) ?? zones[0],
    [zones, effectiveZoneId]
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

  const existingOccupantSpecies = useMemo(() => {
    if (!existingOccupantAtPending) return undefined;
    return PLANT_SPECIES_BY_ID[existingOccupantAtPending.speciesId];
  }, [existingOccupantAtPending]);

  const handleSelectPreset = (preset: BedPreset) => {
    const previousPreset = BED_PRESETS.find((p) => p.id === selectedPresetId);
    const shouldReplaceName = !name.trim() || (previousPreset !== undefined && name.trim() === previousPreset.defaultName);

    setSelectedPresetId(preset.id);
    setZoneType(preset.zoneType);
    setWidthCm(String(preset.widthCm));
    setLengthCm(String(preset.lengthCm));
    setSoilType(preset.soilType);
    if (shouldReplaceName) {
      setName(preset.defaultName);
    }
    setFormError(null);
  };

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

    setShowCreateForm(false);
    setSelectedZoneId(newZone.id);
    setPendingCell(null);
    setValidation(null);
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

  const handleCellPress = async (row: number, col: number) => {
    if (!activeZone || !selectedSpecies) return;
    const occupant = activePlantings.find((p) => p.gridRow === row && p.gridCol === col);
    const result = validatePlantingPlacement({
      zone: activeZone,
      candidateSpecies: selectedSpecies,
      targetRow: row,
      targetCol: col,
      existingPlantings: activePlantings,
      cellSizeCm: 25,
      rotationHistory: rotationHistoryByZone[activeZone.id] ?? []
    });

    if (quickPaintMode && !occupant && result.allowed) {
      await upsertPlanting({
        id: `plant_${Date.now()}_${row}_${col}`,
        zoneId: activeZone.id,
        speciesId: selectedSpecies.id,
        plantedDateIso: new Date().toISOString().slice(0, 10),
        growthStage: 'Seedling',
        gridRow: row,
        gridCol: col,
        moistureDeficitMm: 0
      });
      setPendingCell({ row, col });
      setValidation(result);
      await onWorkspaceChanged();
      return;
    }

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

  const previewRows = Math.max(1, Math.floor((Number(widthCm) || 0) / 25));
  const previewCols = Math.max(1, Math.floor((Number(lengthCm) || 0) / 25));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>
            Garden Beds & Zones ({zones.length}/{profile.isPro ? '∞' : FREE_TIER_MAX_ZONES} Free)
          </Text>
          <Text style={styles.sectionSubtitle}>Tap a bed to plan on its 25 cm planting grid</Text>
        </View>
        <Pressable
          style={[styles.addBtn, showCreateForm && styles.addBtnCancel]}
          onPress={() => {
            setFormError(null);
            setShowCreateForm((prev) => !prev);
          }}
        >
          <Text style={[styles.addBtnText, showCreateForm && styles.addBtnCancelText]}>
            {showCreateForm ? 'Close' : '+ New Bed'}
          </Text>
        </Pressable>
      </View>

      {showCreateForm && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick-Start Bed Presets</Text>
          <Text style={styles.cardMeta}>Pick a template or enter custom dimensions below.</Text>

          <View style={styles.presetRow}>
            {BED_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => handleSelectPreset(preset)}
                  style={[styles.presetCard, isSelected && styles.presetCardActive]}
                >
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  <Text style={[styles.presetLabel, isSelected && styles.presetLabelActive]}>
                    {preset.label}
                  </Text>
                  <Text style={styles.presetSub}>{preset.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Bed Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. North Raised Bed, Deck Pots"
            placeholderTextColor="#64748B"
          />

          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <Text style={styles.label}>Width (cm)</Text>
              <TextInput
                style={styles.input}
                value={widthCm}
                onChangeText={(val) => {
                  setWidthCm(val);
                  setSelectedPresetId('');
                }}
                keyboardType="numeric"
                placeholder="120"
                placeholderTextColor="#64748B"
              />
            </View>
            <View style={styles.dimCol}>
              <Text style={styles.label}>Length (cm)</Text>
              <TextInput
                style={styles.input}
                value={lengthCm}
                onChangeText={(val) => {
                  setLengthCm(val);
                  setSelectedPresetId('');
                }}
                keyboardType="numeric"
                placeholder="240"
                placeholderTextColor="#64748B"
              />
            </View>
            <View style={styles.dimPreviewBox}>
              <Text style={styles.dimPreviewLabel}>Grid</Text>
              <Text style={styles.dimPreviewValue}>
                {previewRows}×{previewCols}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setShowAdvancedBedOptions((prev) => !prev)}
            style={styles.advancedToggle}
          >
            <Text style={styles.advancedToggleText}>
              {showAdvancedBedOptions ? '▾ Hide' : '▸ Customise'} Type, Sun & Soil ({zoneType} · {sunAspect} · {soilType})
            </Text>
          </Pressable>

          {showAdvancedBedOptions && (
            <View style={styles.advancedSection}>
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
            </View>
          )}

          {formError && <Text style={styles.errorText}>{formError}</Text>}

          <Pressable style={styles.primaryBtn} onPress={handleCreateZone}>
            <Text style={styles.primaryBtnText}>Create Bed / Zone</Text>
          </Pressable>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {zones.map((z) => {
          const active = activeZone?.id === z.id;
          const plantCount = (plantingsByZone[z.id] ?? []).length;
          return (
            <Pressable
              key={z.id}
              onPress={() => {
                setSelectedZoneId(z.id);
                setPendingCell(null);
                setValidation(null);
              }}
              style={[styles.bedPill, active && styles.bedPillActive]}
            >
              <Text style={[styles.bedPillText, active && styles.bedPillTextActive]}>
                {z.name} ({plantCount})
              </Text>
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
                {activeZone.zoneType} · {activeZone.widthCm}×{activeZone.lengthCm} cm ·{' '}
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

          <View style={styles.brushBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brushEyebrow}>ACTIVE PLANT BRUSH</Text>
              <Text style={styles.brushTitle}>
                {selectedSpecies
                  ? `${getSpeciesEmoji(selectedSpecies)} ${selectedSpecies.commonName}`
                  : 'Select a plant'}
              </Text>
            </View>
            <Pressable
              style={[styles.brushToggleBtn, quickPaintMode && styles.brushToggleBtnActive]}
              onPress={() => setQuickPaintMode((prev) => !prev)}
            >
              <Text
                style={[styles.brushToggleText, quickPaintMode && styles.brushToggleTextActive]}
              >
                {quickPaintMode ? '🖌️ Quick On' : '🖌️ Quick'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.brushToggleBtn, showPlantPicker && styles.brushToggleBtnActive]}
              onPress={() => setShowPlantPicker((prev) => !prev)}
            >
              <Text
                style={[styles.brushToggleText, showPlantPicker && styles.brushToggleTextActive]}
              >
                {showPlantPicker ? 'Done' : 'Change'}
              </Text>
            </Pressable>
          </View>

          {showPlantPicker && (
            <View style={styles.pickerDrawer}>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={plantQuery}
                  onChangeText={setPlantQuery}
                  placeholder="Search plants (tomato, kūmara, kōwhai, feijoa)..."
                  placeholderTextColor="#64748B"
                />
                {plantQuery.length > 0 && (
                  <Pressable style={styles.clearSearchBtn} onPress={() => setPlantQuery('')}>
                    <Text style={styles.clearSearchText}>Clear</Text>
                  </Pressable>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {CATEGORY_FILTERS.map((cat) => {
                  const active = selectedCategory === cat.value;
                  const isNppa = cat.value === 'NPPA Weed';
                  return (
                    <Pressable
                      key={cat.label}
                      onPress={() => setSelectedCategory(cat.value)}
                      style={[
                        styles.filterPill,
                        isNppa && styles.filterPillNppa,
                        active && (isNppa ? styles.filterPillNppaActive : styles.filterPillActive)
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          isNppa && styles.filterPillNppaText,
                          active && styles.filterPillTextActive
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {filteredSpecies.length === 0 ? (
                <Text style={styles.emptySearchText}>
                  No plants match "{plantQuery}". Try another name or tap All.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {filteredSpecies.map((sp) => {
                    const active = selectedSpecies?.id === sp.id;
                    const visual = getSpeciesVisual(sp);
                    return (
                      <Pressable
                        key={sp.id}
                        onPress={() => {
                          setSelectedSpecies(sp);
                          setPendingCell(null);
                          setValidation(null);
                          setShowPlantPicker(false);
                        }}
                        style={[
                          styles.plantChip,
                          sp.isNppaWeed && styles.nppaChip,
                          active && styles.chipActive
                        ]}
                      >
                        <Text style={styles.plantChipEmoji}>{visual.emoji}</Text>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {sp.commonName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          <View style={styles.timberFrame}>
            <View style={styles.soilTopRow}>
              <Text style={styles.soilTitle}>
                25 cm Grid ({grid.rows}×{grid.cols}){grid.cols > 5 ? ' · ← Scroll →' : ''}
              </Text>
              <View style={styles.aspectBadge}>
                <Text style={styles.aspectBadgeText}>☀️ {activeZone.sunAspect}</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                      const visual = occupantSpecies ? getSpeciesVisual(occupantSpecies) : null;
                      const isSelected =
                        pendingCell?.row === rIdx && pendingCell?.col === cIdx;

                      return (
                        <Pressable
                          key={`${rIdx}_${cIdx}`}
                          onPress={() => handleCellPress(rIdx, cIdx)}
                          style={[
                            styles.gridCell,
                            visual
                              ? {
                                  backgroundColor: visual.bg,
                                  borderColor: visual.border,
                                  borderStyle: 'solid'
                                }
                              : styles.gridCellSoil,
                            isSelected && styles.gridCellSelected
                          ]}
                        >
                          {visual ? (
                            <>
                              <Text style={styles.gridCellEmoji}>{visual.emoji}</Text>
                              <Text
                                style={[styles.gridCellCode, { color: visual.text }]}
                                numberOfLines={1}
                              >
                                {visual.shortCode}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.gridCellPlus}>+</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {validation && pendingCell && (
            <View
              style={[
                styles.inspectorCard,
                !validation.allowed && styles.inspectorCardError
              ]}
            >
              <View style={styles.inspectorHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inspectorEyebrow}>
                    {existingOccupantAtPending ? 'PLANTED SPOT' : 'EMPTY SPOT'} · ROW{' '}
                    {pendingCell.row + 1}, COL {pendingCell.col + 1}
                  </Text>
                  {existingOccupantAtPending && existingOccupantSpecies ? (
                    <>
                      <Text style={styles.inspectorTitle}>
                        {getSpeciesEmoji(existingOccupantSpecies)}{' '}
                        {existingOccupantSpecies.commonName}
                      </Text>
                      <Text style={styles.inspectorMeta}>
                        {existingOccupantAtPending.growthStage} · Moisture deficit{' '}
                        {existingOccupantAtPending.moistureDeficitMm}mm
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.inspectorTitle}>
                        {selectedSpecies
                          ? `Plant ${getSpeciesEmoji(selectedSpecies)} ${selectedSpecies.commonName}`
                          : 'Select a plant'}
                      </Text>
                      {selectedSpecies && (
                        <Text style={styles.inspectorMeta}>
                          {selectedSpecies.category} · Spacing {selectedSpecies.spacingCm} cm ·{' '}
                          {selectedSpecies.sunRequirement}
                        </Text>
                      )}
                    </>
                  )}
                </View>
                <Pressable
                  onPress={() => {
                    setPendingCell(null);
                    setValidation(null);
                  }}
                  style={styles.inspectorCloseBtn}
                >
                  <Text style={styles.inspectorCloseText}>✕</Text>
                </Pressable>
              </View>

              {!validation.allowed ? (
                <View style={styles.feedbackBlockError}>
                  <Text style={styles.errorText}>⛔ {validation.biosecurityBlock}</Text>
                </View>
              ) : (
                <View style={styles.feedbackList}>
                  {validation.companionHighlights.map((msg) => (
                    <View key={msg} style={styles.feedbackRowGood}>
                      <Text style={styles.companionText}>✅ {msg}</Text>
                    </View>
                  ))}
                  {validation.spacingWarnings.map((msg) => (
                    <View key={msg} style={styles.feedbackRowWarn}>
                      <Text style={styles.warningText}>⚠️ {msg}</Text>
                    </View>
                  ))}
                  {validation.antagonistWarnings.map((msg) => (
                    <View key={msg} style={styles.feedbackRowWarn}>
                      <Text style={styles.warningText}>⚠️ {msg}</Text>
                    </View>
                  ))}
                  {validation.rotationWarnings.map((msg) => (
                    <View key={msg} style={styles.feedbackRowRotation}>
                      <Text style={styles.rotationText}>🔄 {msg}</Text>
                    </View>
                  ))}
                  {validation.companionHighlights.length === 0 &&
                    validation.spacingWarnings.length === 0 &&
                    validation.antagonistWarnings.length === 0 &&
                    validation.rotationWarnings.length === 0 && (
                      <View style={styles.feedbackRowNeutral}>
                        <Text style={styles.neutralFeedbackText}>
                          ✅ Spacing, companion & rotation checks all clear.
                        </Text>
                      </View>
                    )}

                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.primaryBtn, { flex: 1 }]}
                      onPress={handleConfirmPlanting}
                    >
                      <Text style={styles.primaryBtnText}>
                        {existingOccupantAtPending && selectedSpecies
                          ? `Replace with ${selectedSpecies.commonName}`
                          : 'Plant Here'}
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
                </View>
              )}
            </View>
          )}

          <Text style={styles.label}>Planted in {activeZone.name} ({activePlantings.length})</Text>
          {activePlantings.length === 0 ? (
            <Text style={styles.emptyPlantingsText}>
              Tap any soil square (+) above to start planting.
            </Text>
          ) : (
            activePlantings.map((p) => {
              const sp = PLANT_SPECIES_BY_ID[p.speciesId];
              const emoji = sp ? getSpeciesEmoji(sp) : '🌱';
              return (
                <View key={p.id} style={styles.plantingRow}>
                  <Text style={[styles.cardText, { flex: 1 }]}>
                    {emoji} {sp?.commonName ?? p.speciesId}
                    {sp?.teReoName ? ` (${sp.teReoName})` : ''} · Row {p.gridRow + 1}, Col {p.gridCol + 1}
                  </Text>
                  <Pressable onPress={() => handleRemovePlanting(p.id)}>
                    <Text style={styles.removeLink}>Remove</Text>
                  </Pressable>
                </View>
              );
            })
          )}
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
    alignItems: 'center',
    gap: 8
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginTop: 1 },
  addBtn: {
    backgroundColor: '#166534',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addBtnCancel: {
    backgroundColor: '#E2E8F0'
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  addBtnCancelText: { color: '#334155' },
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
    gap: 10
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#64748B' },
  cardText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 2 },
  presetRow: {
    flexDirection: 'row',
    gap: 8
  },
  presetCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    gap: 3
  },
  presetCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#166534'
  },
  presetEmoji: { fontSize: 18 },
  presetLabel: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  presetLabelActive: { color: '#166534' },
  presetSub: { fontSize: 10, color: '#64748B' },
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
  dimRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  dimCol: { flex: 1, gap: 4 },
  dimPreviewBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  dimPreviewLabel: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  dimPreviewValue: { fontSize: 13, color: '#0F172A', fontWeight: '800' },
  advancedToggle: {
    paddingVertical: 4
  },
  advancedToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534'
  },
  advancedSection: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  chipScroll: { flexGrow: 0 },
  bedPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginRight: 8
  },
  bedPillActive: {
    backgroundColor: '#166534',
    borderColor: '#166534'
  },
  bedPillText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  bedPillTextActive: { color: '#FFFFFF' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8
  },
  plantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8
  },
  plantChipEmoji: { fontSize: 13 },
  nppaChip: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  chipActive: { backgroundColor: '#166534', borderColor: '#166534' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  clearSearchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  clearSearchText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A'
  },
  filterPillNppa: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5'
  },
  filterPillNppaActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626'
  },
  filterPillText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  filterPillNppaText: { color: '#B91C1C' },
  filterPillTextActive: { color: '#FFFFFF' },
  emptySearchText: { fontSize: 12, color: '#64748B', fontStyle: 'italic', paddingVertical: 4 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  primaryBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  removeBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 4
  },
  removeBtnText: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  plantingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2
  },
  emptyPlantingsText: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  removeLink: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginRight: 4
  },
  gridWrap: { gap: 6, paddingVertical: 2 },
  gridRow: { flexDirection: 'row', gap: 6 },
  brushBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10
  },
  brushEyebrow: { fontSize: 10, fontWeight: '800', color: '#15803D', letterSpacing: 0.5 },
  brushTitle: { fontSize: 14, fontWeight: '800', color: '#14532D', marginTop: 1 },
  brushToggleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#166534',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  brushToggleBtnActive: {
    backgroundColor: '#166534'
  },
  brushToggleText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  brushToggleTextActive: { color: '#FFFFFF' },
  pickerDrawer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  timberFrame: {
    backgroundColor: '#4E342E',
    borderRadius: 14,
    borderWidth: 4,
    borderColor: '#92400E',
    padding: 10,
    gap: 8
  },
  soilTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  soilTitle: { fontSize: 11, fontWeight: '700', color: '#FDE68A' },
  aspectBadge: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  aspectBadgeText: { fontSize: 10, fontWeight: '700', color: '#FEF3C7' },
  gridCell: {
    width: 58,
    height: 58,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    gap: 2
  },
  gridCellSoil: {
    backgroundColor: '#5D4037',
    borderColor: '#8D6E63',
    borderStyle: 'dashed'
  },
  gridCellSelected: {
    borderWidth: 2.5,
    borderColor: '#FBBF24'
  },
  gridCellEmoji: { fontSize: 20, lineHeight: 22 },
  gridCellCode: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  gridCellPlus: { fontSize: 18, color: '#BCAAA4', fontWeight: '700' },
  inspectorCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    gap: 8
  },
  inspectorCardError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626'
  },
  inspectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  inspectorEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6
  },
  inspectorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2
  },
  inspectorMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1
  },
  inspectorCloseBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E2E8F0'
  },
  inspectorCloseText: { fontSize: 12, fontWeight: '800', color: '#334155' },
  occupantBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  occupantBannerText: { fontSize: 12, color: '#1E3A8A', fontWeight: '600' },
  feedbackList: { gap: 6 },
  feedbackBlockError: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10
  },
  feedbackRowGood: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#BBF7D0'
  },
  feedbackRowWarn: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  feedbackRowRotation: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  feedbackRowNeutral: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#BBF7D0'
  },
  companionText: { fontSize: 12, color: '#15803D', fontWeight: '600' },
  warningText: { fontSize: 12, color: '#B45309', fontWeight: '600' },
  rotationText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },
  neutralFeedbackText: { fontSize: 12, color: '#15803D', fontWeight: '600' },
  errorText: { fontSize: 12, color: '#DC2626', fontWeight: '700' }
});
