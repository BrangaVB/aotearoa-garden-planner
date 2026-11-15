import {
  ClimateZone,
  CouncilWaterRule,
  GardenProfile,
  PostcodeLookupEntry,
  RestrictionStage
} from '../types/domain';

/* -------------------------------------------------------------------------- */
/*                               Climate zones                                */
/* -------------------------------------------------------------------------- */
/*
 * Frost dates and rainfall are representative values seeded from NIWA climate normals
 * for the main population centre in each zone. They are planning guides, not forecasts;
 * the live Open-Meteo forecast drives actual frost-cloth alerts.
 */
export const NZ_CLIMATE_ZONES: Record<string, ClimateZone> = {
  'nz-northland-auckland': {
    id: 'nz-northland-auckland',
    name: 'Subtropical North & Auckland Isthmus',
    region: 'Northland / Auckland',
    meanLastSpringFrost: '08-10',
    springFrostP90: '08-28',
    meanFirstAutumnFrost: '06-15',
    annualRainfallMm: 1210,
    annualSunshineHours: 2000,
    windExposure: 'Moderate',
    notes: 'Warm, humid summers ideal for citrus, kūmara, and subtropicals; watch humidity-driven fungal blight and summer water restrictions.'
  },
  'nz-waikato-bop': {
    id: 'nz-waikato-bop',
    name: 'Waikato Basin & Bay of Plenty',
    region: 'Waikato / Bay of Plenty',
    meanLastSpringFrost: '09-18',
    springFrostP90: '10-08',
    meanFirstAutumnFrost: '05-12',
    annualRainfallMm: 1180,
    annualSunshineHours: 2250,
    windExposure: 'Low',
    notes: 'High sunshine hours and fertile volcanic/alluvial soils, but clear calm winter nights bring sharp radiation frosts inland.'
  },
  'nz-central-plateau': {
    id: 'nz-central-plateau',
    name: 'Central Volcanic Plateau',
    region: 'Taupō / Ruapehu',
    meanLastSpringFrost: '10-25',
    springFrostP90: '11-15',
    meanFirstAutumnFrost: '04-10',
    annualRainfallMm: 1100,
    annualSunshineHours: 2000,
    windExposure: 'Moderate',
    notes: 'High-altitude pumice soils drain fast and frosts can strike in any month; raised beds and cloches extend the short season.'
  },
  'nz-gisborne-hawkes-bay': {
    id: 'nz-gisborne-hawkes-bay',
    name: 'Tairāwhiti & Hawke’s Bay',
    region: 'Gisborne / Hawke’s Bay',
    meanLastSpringFrost: '09-05',
    springFrostP90: '09-30',
    meanFirstAutumnFrost: '05-20',
    annualRainfallMm: 900,
    annualSunshineHours: 2200,
    windExposure: 'Moderate',
    notes: 'Hot, dry summers and fertile river plains suit stonefruit, pipfruit, and grapes; summer drought and dry nor’westers make mulching essential.'
  },
  'nz-taranaki-manawatu': {
    id: 'nz-taranaki-manawatu',
    name: 'Taranaki, Whanganui & Manawatū',
    region: 'Taranaki / Manawatū-Whanganui',
    meanLastSpringFrost: '09-15',
    springFrostP90: '10-10',
    meanFirstAutumnFrost: '05-15',
    annualRainfallMm: 1300,
    annualSunshineHours: 2000,
    windExposure: 'High',
    notes: 'Reliable rainfall and rich volcanic loams; persistent westerlies off the Tasman make shelter belts and staking important.'
  },
  'nz-wellington-hutt': {
    id: 'nz-wellington-hutt',
    name: 'Wellington Harbour & Hutt Valley',
    region: 'Greater Wellington',
    meanLastSpringFrost: '09-12',
    springFrostP90: '10-05',
    meanFirstAutumnFrost: '05-25',
    annualRainfallMm: 1250,
    annualSunshineHours: 2050,
    windExposure: 'High Coastal/Cook Strait',
    notes: 'Sheltered Hutt Valley floors see sharper winter frosts than coastal suburbs, while spring equinoctial northwesterlies require wind-hardy staking.'
  },
  'nz-wairarapa': {
    id: 'nz-wairarapa',
    name: 'Wairarapa Valley',
    region: 'Wairarapa',
    meanLastSpringFrost: '10-05',
    springFrostP90: '10-25',
    meanFirstAutumnFrost: '04-28',
    annualRainfallMm: 950,
    annualSunshineHours: 2100,
    windExposure: 'High',
    notes: 'Rain-shadowed valley with hot dry summers and hard inland frosts; strong nor’westers dry beds out fast.'
  },
  'nz-top-of-south': {
    id: 'nz-top-of-south',
    name: 'Nelson, Tasman & Marlborough',
    region: 'Top of the South',
    meanLastSpringFrost: '09-25',
    springFrostP90: '10-15',
    meanFirstAutumnFrost: '05-05',
    annualRainfallMm: 970,
    annualSunshineHours: 2400,
    windExposure: 'Moderate',
    notes: 'High sunshine and drier summers; summer water rationing is common in Tasman and Marlborough.'
  },
  'nz-west-coast': {
    id: 'nz-west-coast',
    name: 'Te Tai Poutini West Coast',
    region: 'West Coast',
    meanLastSpringFrost: '09-20',
    springFrostP90: '10-15',
    meanFirstAutumnFrost: '05-10',
    annualRainfallMm: 2500,
    annualSunshineHours: 1850,
    windExposure: 'Moderate',
    notes: 'Very high rainfall and mild coastal temperatures; focus on drainage, raised beds, and slug control rather than irrigation.'
  },
  'nz-canterbury': {
    id: 'nz-canterbury',
    name: 'Canterbury Plains & Banks Peninsula',
    region: 'Canterbury',
    meanLastSpringFrost: '10-12',
    springFrostP90: '10-28',
    meanFirstAutumnFrost: '04-22',
    annualRainfallMm: 620,
    annualSunshineHours: 2100,
    windExposure: 'Moderate',
    notes: 'Low annual rainfall and hot dry nor’westers; deep mulching and drip irrigation are essential over summer.'
  },
  'nz-otago-southland': {
    id: 'nz-otago-southland',
    name: 'Coastal Otago',
    region: 'Otago',
    meanLastSpringFrost: '11-02',
    springFrostP90: '11-18',
    meanFirstAutumnFrost: '04-05',
    annualRainfallMm: 740,
    annualSunshineHours: 1600,
    windExposure: 'Moderate',
    notes: 'Short, crisp growing season with late spring frosts into November; protect tender crops until mid-November or use cloches.'
  },
  'nz-central-otago': {
    id: 'nz-central-otago',
    name: 'Central Otago & Southern Lakes',
    region: 'Central Otago / Queenstown Lakes',
    meanLastSpringFrost: '11-10',
    springFrostP90: '11-28',
    meanFirstAutumnFrost: '03-28',
    annualRainfallMm: 400,
    annualSunshineHours: 2050,
    windExposure: 'Moderate',
    notes: 'Semi-arid continental climate: hottest summers and hardest frosts in NZ. Superb for stonefruit; irrigation is essential.'
  },
  'nz-southland': {
    id: 'nz-southland',
    name: 'Southland Plains',
    region: 'Southland',
    meanLastSpringFrost: '11-05',
    springFrostP90: '11-25',
    meanFirstAutumnFrost: '04-01',
    annualRainfallMm: 1100,
    annualSunshineHours: 1650,
    windExposure: 'High',
    notes: 'Cool, moist, and windy with long summer daylight; brassicas, root crops, and berries thrive. Shelter tender crops.'
  },
  'nz-chatham-islands': {
    id: 'nz-chatham-islands',
    name: 'Rēkohu / Wharekauri Chatham Islands',
    region: 'Chatham Islands',
    meanLastSpringFrost: '09-30',
    springFrostP90: '10-20',
    meanFirstAutumnFrost: '05-30',
    annualRainfallMm: 900,
    annualSunshineHours: 1400,
    windExposure: 'High',
    notes: 'Oceanic, cloudy, and very windy; salt-tolerant shelter and windbreak cloth make the biggest difference.'
  }
};

/* -------------------------------------------------------------------------- */
/*                    Restriction stage templates (Level 0–4)                 */
/* -------------------------------------------------------------------------- */

type StagePermissions = Pick<
  CouncilWaterRule,
  | 'stageLabel'
  | 'sprinklersAllowed'
  | 'irrigationSystemAllowed'
  | 'handHeldHoseAllowed'
  | 'wateringCanAllowed'
  | 'oddEvenRule'
  | 'allowedHoursLabel'
  | 'summary'
>;

/**
 * Generic NZ restriction semantics. Individual councils name their levels differently
 * (Alert Level, Phase A/B, Stage 1–4) but the outdoor-use permissions map onto these tiers.
 */
export const RESTRICTION_STAGE_TEMPLATES: Record<RestrictionStage, StagePermissions> = {
  0: {
    stageLabel: 'Level 0 — No Active Restrictions',
    sprinklersAllowed: true,
    irrigationSystemAllowed: true,
    handHeldHoseAllowed: true,
    wateringCanAllowed: true,
    oddEvenRule: false,
    allowedHoursLabel: 'Anytime — best before 9:00am or after 6:00pm',
    summary: 'No restrictions recorded. Water early or late, use a trigger nozzle, and mulch to conserve supply.'
  },
  1: {
    stageLabel: 'Level 1 — Alternate-Day Sprinklers',
    sprinklersAllowed: true,
    irrigationSystemAllowed: true,
    handHeldHoseAllowed: true,
    wateringCanAllowed: true,
    oddEvenRule: true,
    allowedHoursLabel: '6:00am–8:00am & 6:00pm–8:00pm on odd/even days matching your street number',
    summary: 'Sprinklers and irrigation only on alternate days matching your street number, morning or evening. Hand-held hoses and cans allowed anytime.'
  },
  2: {
    stageLabel: 'Level 2 — Hand-Held Hose & Drip Only',
    sprinklersAllowed: false,
    irrigationSystemAllowed: true,
    handHeldHoseAllowed: true,
    wateringCanAllowed: true,
    oddEvenRule: false,
    allowedHoursLabel: 'Before 9:00am or after 7:00pm',
    summary: 'Sprinklers banned. Hand-held hoses with trigger nozzles and drip/soaker irrigation permitted outside peak heat.'
  },
  3: {
    stageLabel: 'Level 3 — Watering Can / Bucket Only',
    sprinklersAllowed: false,
    irrigationSystemAllowed: false,
    handHeldHoseAllowed: false,
    wateringCanAllowed: true,
    oddEvenRule: false,
    allowedHoursLabel: 'Watering can or bucket only — any time',
    summary: 'All hoses and irrigation systems banned. Food gardens may be watered using a watering can or bucket.'
  },
  4: {
    stageLabel: 'Level 4 — Total Outdoor Water Ban',
    sprinklersAllowed: false,
    irrigationSystemAllowed: false,
    handHeldHoseAllowed: false,
    wateringCanAllowed: false,
    oddEvenRule: false,
    allowedHoursLabel: 'No outdoor mains water use',
    summary: 'All outdoor use of mains water is prohibited. Use rainwater tanks or household greywater only.'
  }
};

/* -------------------------------------------------------------------------- */
/*                     Territorial authority registry (67)                    */
/* -------------------------------------------------------------------------- */

interface AuthoritySeed {
  id: string;
  authorityName: string;
  authorityType: NonNullable<CouncilWaterRule['authorityType']>;
  region: string;
  waterProvider: string;
  territories: string[];
}

const BASELINE_DATE = '2026-11-01';

/**
 * All 67 New Zealand territorial authorities: 13 city councils, 53 district councils,
 * and the Chatham Islands Council (Local Government Act 2002, Schedule 2).
 */
export const NZ_TERRITORIAL_AUTHORITIES: AuthoritySeed[] = [
  // Northland
  { id: 'far-north', authorityName: 'Far North District Council', authorityType: 'District Council', region: 'Northland', waterProvider: 'Far North District Council', territories: ['Kerikeri', 'Kaitaia', 'Kaikohe', 'Paihia'] },
  { id: 'whangarei', authorityName: 'Whangārei District Council', authorityType: 'District Council', region: 'Northland', waterProvider: 'Whangārei District Council', territories: ['Whangārei', 'Ruakākā', 'Hikurangi'] },
  { id: 'kaipara', authorityName: 'Kaipara District Council', authorityType: 'District Council', region: 'Northland', waterProvider: 'Kaipara District Council', territories: ['Dargaville', 'Mangawhai', 'Kaiwaka'] },
  // Auckland
  { id: 'auckland', authorityName: 'Auckland Council', authorityType: 'Unitary Authority', region: 'Auckland', waterProvider: 'Watercare Services', territories: ['Auckland', 'North Shore', 'Waitākere', 'Manukau', 'Papakura', 'Pukekohe'] },
  // Waikato
  { id: 'thames-coromandel', authorityName: 'Thames-Coromandel District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'Thames-Coromandel District Council', territories: ['Thames', 'Whitianga', 'Coromandel', 'Whangamatā'] },
  { id: 'hauraki', authorityName: 'Hauraki District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'Hauraki District Council', territories: ['Paeroa', 'Waihī', 'Ngatea'] },
  { id: 'waikato-district', authorityName: 'Waikato District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'Watercare (Waikato District)', territories: ['Ngāruawāhia', 'Huntly', 'Pōkeno', 'Raglan'] },
  { id: 'matamata-piako', authorityName: 'Matamata-Piako District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'Matamata-Piako District Council', territories: ['Matamata', 'Morrinsville', 'Te Aroha'] },
  { id: 'hamilton-city', authorityName: 'Hamilton City Council', authorityType: 'City Council', region: 'Waikato', waterProvider: 'Hamilton City Council (Smart Water)', territories: ['Hamilton'] },
  { id: 'waipa', authorityName: 'Waipā District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'Waipā District Council', territories: ['Te Awamutu', 'Cambridge'] },
  { id: 'otorohanga', authorityName: 'Ōtorohanga District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'Ōtorohanga District Council', territories: ['Ōtorohanga', 'Kāwhia'] },
  { id: 'south-waikato', authorityName: 'South Waikato District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'South Waikato District Council', territories: ['Tokoroa', 'Putāruru', 'Tīrau'] },
  { id: 'waitomo', authorityName: 'Waitomo District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'Waitomo District Council', territories: ['Te Kūiti', 'Piopio'] },
  { id: 'taupo', authorityName: 'Taupō District Council', authorityType: 'District Council', region: 'Waikato', waterProvider: 'Taupō District Council', territories: ['Taupō', 'Tūrangi', 'Mangakino'] },
  // Bay of Plenty
  { id: 'western-bay-of-plenty', authorityName: 'Western Bay of Plenty District Council', authorityType: 'District Council', region: 'Bay of Plenty', waterProvider: 'Western Bay of Plenty District Council', territories: ['Te Puke', 'Katikati', 'Waihī Beach', 'Ōmokoroa'] },
  { id: 'tauranga-city', authorityName: 'Tauranga City Council', authorityType: 'City Council', region: 'Bay of Plenty', waterProvider: 'Tauranga City Council', territories: ['Tauranga', 'Mount Maunganui', 'Pāpāmoa'] },
  { id: 'rotorua-lakes', authorityName: 'Rotorua Lakes Council', authorityType: 'District Council', region: 'Bay of Plenty', waterProvider: 'Rotorua Lakes Council', territories: ['Rotorua', 'Ngongotahā'] },
  { id: 'whakatane', authorityName: 'Whakatāne District Council', authorityType: 'District Council', region: 'Bay of Plenty', waterProvider: 'Whakatāne District Council', territories: ['Whakatāne', 'Ōhope', 'Edgecumbe', 'Murupara'] },
  { id: 'kawerau', authorityName: 'Kawerau District Council', authorityType: 'District Council', region: 'Bay of Plenty', waterProvider: 'Kawerau District Council', territories: ['Kawerau'] },
  { id: 'opotiki', authorityName: 'Ōpōtiki District Council', authorityType: 'District Council', region: 'Bay of Plenty', waterProvider: 'Ōpōtiki District Council', territories: ['Ōpōtiki'] },
  // Gisborne
  { id: 'gisborne', authorityName: 'Gisborne District Council', authorityType: 'Unitary Authority', region: 'Gisborne', waterProvider: 'Gisborne District Council', territories: ['Gisborne', 'Tolaga Bay', 'Ruatōria'] },
  // Hawke's Bay
  { id: 'wairoa', authorityName: 'Wairoa District Council', authorityType: 'District Council', region: 'Hawke’s Bay', waterProvider: 'Wairoa District Council', territories: ['Wairoa'] },
  { id: 'hastings', authorityName: 'Hastings District Council', authorityType: 'District Council', region: 'Hawke’s Bay', waterProvider: 'Hastings District Council', territories: ['Hastings', 'Havelock North', 'Flaxmere'] },
  { id: 'napier-city', authorityName: 'Napier City Council', authorityType: 'City Council', region: 'Hawke’s Bay', waterProvider: 'Napier City Council', territories: ['Napier', 'Taradale'] },
  { id: 'central-hawkes-bay', authorityName: 'Central Hawke’s Bay District Council', authorityType: 'District Council', region: 'Hawke’s Bay', waterProvider: 'Central Hawke’s Bay District Council', territories: ['Waipukurau', 'Waipawa'] },
  // Taranaki
  { id: 'new-plymouth', authorityName: 'New Plymouth District Council', authorityType: 'District Council', region: 'Taranaki', waterProvider: 'New Plymouth District Council', territories: ['New Plymouth', 'Waitara', 'Inglewood'] },
  { id: 'stratford', authorityName: 'Stratford District Council', authorityType: 'District Council', region: 'Taranaki', waterProvider: 'Stratford District Council', territories: ['Stratford'] },
  { id: 'south-taranaki', authorityName: 'South Taranaki District Council', authorityType: 'District Council', region: 'Taranaki', waterProvider: 'South Taranaki District Council', territories: ['Hāwera', 'Ōpunake', 'Pātea'] },
  // Manawatū-Whanganui
  { id: 'ruapehu', authorityName: 'Ruapehu District Council', authorityType: 'District Council', region: 'Manawatū-Whanganui', waterProvider: 'Ruapehu District Council', territories: ['Taumarunui', 'Ohakune', 'Raetihi'] },
  { id: 'whanganui', authorityName: 'Whanganui District Council', authorityType: 'District Council', region: 'Manawatū-Whanganui', waterProvider: 'Whanganui District Council', territories: ['Whanganui'] },
  { id: 'rangitikei', authorityName: 'Rangitīkei District Council', authorityType: 'District Council', region: 'Manawatū-Whanganui', waterProvider: 'Rangitīkei District Council', territories: ['Marton', 'Taihape', 'Bulls'] },
  { id: 'manawatu', authorityName: 'Manawatū District Council', authorityType: 'District Council', region: 'Manawatū-Whanganui', waterProvider: 'Manawatū District Council', territories: ['Feilding'] },
  { id: 'palmerston-north', authorityName: 'Palmerston North City Council', authorityType: 'City Council', region: 'Manawatū-Whanganui', waterProvider: 'Palmerston North City Council', territories: ['Palmerston North', 'Ashhurst'] },
  { id: 'tararua', authorityName: 'Tararua District Council', authorityType: 'District Council', region: 'Manawatū-Whanganui', waterProvider: 'Tararua District Council', territories: ['Dannevirke', 'Pahiatua', 'Woodville'] },
  { id: 'horowhenua', authorityName: 'Horowhenua District Council', authorityType: 'District Council', region: 'Manawatū-Whanganui', waterProvider: 'Horowhenua District Council', territories: ['Levin', 'Foxton', 'Shannon'] },
  // Wellington
  { id: 'kapiti-coast', authorityName: 'Kāpiti Coast District Council', authorityType: 'District Council', region: 'Wellington', waterProvider: 'Kāpiti Coast District Council', territories: ['Paraparaumu', 'Waikanae', 'Ōtaki', 'Raumati'] },
  { id: 'porirua-city', authorityName: 'Porirua City Council', authorityType: 'City Council', region: 'Wellington', waterProvider: 'Wellington Water', territories: ['Porirua', 'Whitby', 'Titahi Bay'] },
  { id: 'upper-hutt-city', authorityName: 'Upper Hutt City Council', authorityType: 'City Council', region: 'Wellington', waterProvider: 'Wellington Water', territories: ['Upper Hutt'] },
  { id: 'hutt-city', authorityName: 'Hutt City Council', authorityType: 'City Council', region: 'Wellington', waterProvider: 'Wellington Water', territories: ['Lower Hutt', 'Petone', 'Eastbourne', 'Wainuiomata'] },
  { id: 'wellington-city', authorityName: 'Wellington City Council', authorityType: 'City Council', region: 'Wellington', waterProvider: 'Wellington Water', territories: ['Wellington', 'Karori', 'Johnsonville', 'Miramar'] },
  { id: 'masterton', authorityName: 'Masterton District Council', authorityType: 'District Council', region: 'Wellington', waterProvider: 'Masterton District Council', territories: ['Masterton'] },
  { id: 'carterton', authorityName: 'Carterton District Council', authorityType: 'District Council', region: 'Wellington', waterProvider: 'Carterton District Council', territories: ['Carterton'] },
  { id: 'south-wairarapa', authorityName: 'South Wairarapa District Council', authorityType: 'District Council', region: 'Wellington', waterProvider: 'Wellington Water', territories: ['Martinborough', 'Featherston', 'Greytown'] },
  // Top of the South
  { id: 'tasman-district', authorityName: 'Tasman District Council', authorityType: 'Unitary Authority', region: 'Tasman', waterProvider: 'Tasman District Council', territories: ['Richmond', 'Motueka', 'Māpua', 'Tākaka'] },
  { id: 'nelson-city', authorityName: 'Nelson City Council', authorityType: 'Unitary Authority', region: 'Nelson', waterProvider: 'Nelson City Council', territories: ['Nelson', 'Stoke', 'Tāhunanui'] },
  { id: 'marlborough', authorityName: 'Marlborough District Council', authorityType: 'Unitary Authority', region: 'Marlborough', waterProvider: 'Marlborough District Council', territories: ['Blenheim', 'Picton', 'Renwick'] },
  // West Coast
  { id: 'buller', authorityName: 'Buller District Council', authorityType: 'District Council', region: 'West Coast', waterProvider: 'Buller District Council', territories: ['Westport', 'Reefton', 'Karamea'] },
  { id: 'grey', authorityName: 'Grey District Council', authorityType: 'District Council', region: 'West Coast', waterProvider: 'Grey District Council', territories: ['Greymouth', 'Runanga'] },
  { id: 'westland', authorityName: 'Westland District Council', authorityType: 'District Council', region: 'West Coast', waterProvider: 'Westland District Council', territories: ['Hokitika', 'Franz Josef', 'Ross'] },
  // Canterbury
  { id: 'kaikoura', authorityName: 'Kaikōura District Council', authorityType: 'District Council', region: 'Canterbury', waterProvider: 'Kaikōura District Council', territories: ['Kaikōura'] },
  { id: 'hurunui', authorityName: 'Hurunui District Council', authorityType: 'District Council', region: 'Canterbury', waterProvider: 'Hurunui District Council', territories: ['Amberley', 'Hanmer Springs', 'Cheviot'] },
  { id: 'waimakariri', authorityName: 'Waimakariri District Council', authorityType: 'District Council', region: 'Canterbury', waterProvider: 'Waimakariri District Council', territories: ['Rangiora', 'Kaiapoi', 'Woodend', 'Oxford'] },
  { id: 'christchurch-city', authorityName: 'Christchurch City Council', authorityType: 'City Council', region: 'Canterbury', waterProvider: 'Christchurch City Council', territories: ['Christchurch', 'Lyttelton', 'Sumner', 'Akaroa'] },
  { id: 'selwyn', authorityName: 'Selwyn District Council', authorityType: 'District Council', region: 'Canterbury', waterProvider: 'Selwyn District Council', territories: ['Rolleston', 'Lincoln', 'Darfield', 'Leeston'] },
  { id: 'ashburton', authorityName: 'Ashburton District Council', authorityType: 'District Council', region: 'Canterbury', waterProvider: 'Ashburton District Council', territories: ['Ashburton', 'Methven', 'Rakaia'] },
  { id: 'timaru', authorityName: 'Timaru District Council', authorityType: 'District Council', region: 'Canterbury', waterProvider: 'Timaru District Council', territories: ['Timaru', 'Temuka', 'Geraldine'] },
  { id: 'mackenzie', authorityName: 'Mackenzie District Council', authorityType: 'District Council', region: 'Canterbury', waterProvider: 'Mackenzie District Council', territories: ['Fairlie', 'Twizel', 'Tekapo'] },
  { id: 'waimate', authorityName: 'Waimate District Council', authorityType: 'District Council', region: 'Canterbury', waterProvider: 'Waimate District Council', territories: ['Waimate'] },
  { id: 'waitaki', authorityName: 'Waitaki District Council', authorityType: 'District Council', region: 'Otago / Canterbury', waterProvider: 'Waitaki District Council', territories: ['Ōamaru', 'Kurow', 'Palmerston'] },
  // Otago
  { id: 'central-otago', authorityName: 'Central Otago District Council', authorityType: 'District Council', region: 'Otago', waterProvider: 'Central Otago District Council', territories: ['Alexandra', 'Cromwell', 'Clyde', 'Ranfurly'] },
  { id: 'queenstown-lakes', authorityName: 'Queenstown-Lakes District Council', authorityType: 'District Council', region: 'Otago', waterProvider: 'Queenstown-Lakes District Council', territories: ['Queenstown', 'Wānaka', 'Arrowtown', 'Frankton'] },
  { id: 'dunedin-city', authorityName: 'Dunedin City Council', authorityType: 'City Council', region: 'Otago', waterProvider: 'Dunedin City Council', territories: ['Dunedin', 'Mosgiel', 'Port Chalmers'] },
  { id: 'clutha', authorityName: 'Clutha District Council', authorityType: 'District Council', region: 'Otago', waterProvider: 'Clutha District Council', territories: ['Balclutha', 'Milton', 'Lawrence'] },
  // Southland
  { id: 'southland-district', authorityName: 'Southland District Council', authorityType: 'District Council', region: 'Southland', waterProvider: 'Southland District Council', territories: ['Winton', 'Te Anau', 'Riverton', 'Lumsden'] },
  { id: 'gore', authorityName: 'Gore District Council', authorityType: 'District Council', region: 'Southland', waterProvider: 'Gore District Council', territories: ['Gore', 'Mataura'] },
  { id: 'invercargill-city', authorityName: 'Invercargill City Council', authorityType: 'City Council', region: 'Southland', waterProvider: 'Invercargill City Council', territories: ['Invercargill', 'Bluff'] },
  // Chatham Islands
  { id: 'chatham-islands', authorityName: 'Chatham Islands Council', authorityType: 'Territorial Authority', region: 'Chatham Islands', waterProvider: 'Chatham Islands Council (rainwater tanks)', territories: ['Waitangi', 'Pitt Island'] }
];

/**
 * Hand-curated restriction states carried over from the Phase 1 starter registry.
 * In production these are refreshed from the Supabase `council_water_rules` table
 * via the admin dashboard and council page change-detection jobs.
 */
const CURATED_OVERRIDES: Record<string, Partial<CouncilWaterRule> & { stage: RestrictionStage }> = {
  'auckland': {
    stage: 0,
    stageLabel: 'Level 0 — Smart Water Use (No Active Restrictions)',
    allowedHoursLabel: 'Best before 9:00am or after 6:00pm to reduce evaporation',
    summary: 'No formal restrictions active. Use trigger nozzles on hoses and water in the cool of morning or evening.'
  },
  'hamilton-city': {
    stage: 1,
    stageLabel: 'Alert Level 1 — Alternate Days',
    allowedHoursLabel: '6:00am–8:00am & 6:00pm–8:00pm (Odd/Even dates)',
    summary: 'Sprinklers permitted only on odd dates for odd-numbered houses and even dates for even-numbered houses during morning/evening windows.'
  },
  'tauranga-city': {
    stage: 2,
    stageLabel: 'Level 2 — Hand-Held Hose & Drip Only',
    allowedHoursLabel: 'Before 9:00am or after 7:00pm',
    summary: 'Garden sprinklers banned. Hand-held hoses with trigger nozzles and timer-controlled drip irrigation permitted outside peak heat.'
  },
  'tasman-district': {
    stage: 2,
    stageLabel: 'Phase B — Essential Food Garden & Hand-Watering',
    sprinklersAllowed: false,
    irrigationSystemAllowed: false,
    handHeldHoseAllowed: true,
    wateringCanAllowed: true,
    oddEvenRule: true,
    allowedHoursLabel: 'Odd/Even days, hand-held hose for veggie gardens & fruit trees only',
    summary: 'Lawn watering and unattended sprinklers banned. Vegetable gardens and fruit trees may be watered by hand-held hose on alternate days.'
  },
  'christchurch-city': {
    stage: 0,
    stageLabel: 'Level 0 — Normal Summer Advisory',
    allowedHoursLabel: 'Avoid watering between 9:00am and 6:00pm during nor’westers',
    summary: 'Normal watering permitted; mulch beds to 50mm depth to conserve aquifer supply.'
  },
  'dunedin-city': {
    stage: 0,
    stageLabel: 'Level 0 — Normal',
    allowedHoursLabel: 'Anytime (morning recommended)',
    summary: 'No active restrictions. Conserve tank water during dry easterly spells.'
  }
};

/** Wellington Water shared metro rule (applies to all councils it serves). */
const WELLINGTON_WATER_RULE: Partial<CouncilWaterRule> & { stage: RestrictionStage } = {
  stage: 1,
  stageLabel: 'Level 1 — Alternate Days for Sprinklers',
  allowedHoursLabel: '6:00am–8:00am & 7:00pm–9:00pm (Odd/Even street numbers)',
  summary: 'Sprinklers and irrigation systems allowed on alternate days matching your street number between 6–8am and 7–9pm. Hand-held watering cans/hoses with trigger nozzles allowed anytime.'
};

function buildRule(seed: AuthoritySeed): CouncilWaterRule {
  const curated =
    CURATED_OVERRIDES[seed.id] ??
    (seed.waterProvider === 'Wellington Water' ? WELLINGTON_WATER_RULE : undefined);
  const stage: RestrictionStage = curated?.stage ?? 0;
  const template = RESTRICTION_STAGE_TEMPLATES[stage];
  const isRainwaterOnly = seed.id === 'chatham-islands';

  return {
    ...seed,
    ...template,
    stage,
    summary: isRainwaterOnly
      ? 'Most properties rely on private rainwater tanks; council mains restrictions rarely apply. Conserve tank levels through summer.'
      : template.summary,
    ...(curated ?? {}),
    lastUpdatedIso: BASELINE_DATE,
    provenance: curated ? 'curated' : 'baseline'
  };
}

export const NZ_COUNCIL_WATER_RULES: Record<string, CouncilWaterRule> = Object.fromEntries(
  NZ_TERRITORIAL_AUTHORITIES.map((seed) => [seed.id, buildRule(seed)])
);

/** Legacy IDs from the Phase 1 starter, kept so older saved profiles still resolve. */
export const COUNCIL_ID_ALIASES: Record<string, string> = {
  'wellington-water': 'hutt-city',
  'watercare-auckland': 'auckland'
};

export function getCouncilRule(councilId: string): CouncilWaterRule | undefined {
  return NZ_COUNCIL_WATER_RULES[councilId] ?? NZ_COUNCIL_WATER_RULES[COUNCIL_ID_ALIASES[councilId] ?? ''];
}

/**
 * Applies a user-reported stage ("Report local restriction change") on top of the registry rule.
 * Returns the registry rule untouched when no override is set or it matches.
 */
export function applyRestrictionOverride(
  rule: CouncilWaterRule,
  overrideStage?: RestrictionStage
): CouncilWaterRule {
  if (overrideStage === undefined || overrideStage === null || overrideStage === rule.stage) {
    return rule;
  }
  return {
    ...rule,
    ...RESTRICTION_STAGE_TEMPLATES[overrideStage],
    stage: overrideStage,
    provenance: 'user-reported'
  };
}

/** Resolves the effective water rule for a garden profile (registry + user override). */
export function resolveEffectiveCouncilRule(
  profile: Pick<GardenProfile, 'councilId' | 'restrictionStageOverride'>
): CouncilWaterRule {
  const base = getCouncilRule(profile.councilId) ?? NZ_COUNCIL_WATER_RULES['auckland']!;
  return applyRestrictionOverride(base, profile.restrictionStageOverride);
}

/* -------------------------------------------------------------------------- */
/*                         Postcode / suburb directory                        */
/* -------------------------------------------------------------------------- */

type PostcodeTuple = [postcode: string, suburb: string, city: string, lat: number, lon: number, climateZoneId: string, councilId: string];

const NL = 'nz-northland-auckland';
const WB = 'nz-waikato-bop';
const CP = 'nz-central-plateau';
const GH = 'nz-gisborne-hawkes-bay';
const TM = 'nz-taranaki-manawatu';
const WH = 'nz-wellington-hutt';
const WR = 'nz-wairarapa';
const TS = 'nz-top-of-south';
const WC = 'nz-west-coast';
const CB = 'nz-canterbury';
const OT = 'nz-otago-southland';
const CO = 'nz-central-otago';
const SL = 'nz-southland';
const CI = 'nz-chatham-islands';

const POSTCODE_ROWS: PostcodeTuple[] = [
  // Northland
  ['0230', 'Kerikeri', 'Kerikeri', -35.2268, 173.9474, NL, 'far-north'],
  ['0410', 'Kaitaia', 'Kaitaia', -35.1136, 173.2630, NL, 'far-north'],
  ['0110', 'Whangārei Central / Kensington', 'Whangārei', -35.7251, 174.3237, NL, 'whangarei'],
  ['0310', 'Dargaville', 'Dargaville', -35.9406, 173.8697, NL, 'kaipara'],
  ['0505', 'Mangawhai', 'Mangawhai', -36.1280, 174.5770, NL, 'kaipara'],
  // Auckland
  ['1010', 'Auckland Central / Freemans Bay', 'Auckland', -36.8485, 174.7633, NL, 'auckland'],
  ['0612', 'Henderson / Te Atatū', 'Auckland', -36.8781, 174.6305, NL, 'auckland'],
  ['0622', 'Takapuna / Milford', 'Auckland', -36.7880, 174.7700, NL, 'auckland'],
  ['1024', 'Mt Albert / Sandringham', 'Auckland', -36.8840, 174.7190, NL, 'auckland'],
  ['2025', 'Manukau / Ōtara', 'Auckland', -36.9930, 174.8800, NL, 'auckland'],
  ['2120', 'Pukekohe', 'Auckland', -37.2000, 174.9000, NL, 'auckland'],
  // Waikato
  ['3500', 'Thames', 'Thames', -37.1383, 175.5402, WB, 'thames-coromandel'],
  ['3510', 'Whitianga', 'Whitianga', -36.8330, 175.7000, WB, 'thames-coromandel'],
  ['3600', 'Paeroa', 'Paeroa', -37.3797, 175.6717, WB, 'hauraki'],
  ['3700', 'Huntly', 'Huntly', -37.5583, 175.1594, WB, 'waikato-district'],
  ['3225', 'Raglan / Whāingaroa', 'Raglan', -37.8000, 174.8833, WB, 'waikato-district'],
  ['3400', 'Matamata', 'Matamata', -37.8106, 175.7624, WB, 'matamata-piako'],
  ['3204', 'Hamilton East / Claudelands', 'Hamilton', -37.7870, 175.2793, WB, 'hamilton-city'],
  ['3200', 'Hamilton Central / Frankton', 'Hamilton', -37.7880, 175.2650, WB, 'hamilton-city'],
  ['3800', 'Te Awamutu', 'Te Awamutu', -38.0107, 175.3243, WB, 'waipa'],
  ['3434', 'Cambridge', 'Cambridge', -37.8930, 175.4700, WB, 'waipa'],
  ['3900', 'Ōtorohanga', 'Ōtorohanga', -38.1890, 175.2100, WB, 'otorohanga'],
  ['3420', 'Tokoroa', 'Tokoroa', -38.2167, 175.8667, WB, 'south-waikato'],
  ['3910', 'Te Kūiti', 'Te Kūiti', -38.3333, 175.1667, WB, 'waitomo'],
  ['3330', 'Taupō', 'Taupō', -38.6857, 176.0702, CP, 'taupo'],
  ['3334', 'Tūrangi', 'Tūrangi', -38.9890, 175.8080, CP, 'taupo'],
  // Bay of Plenty
  ['3119', 'Te Puke', 'Te Puke', -37.7833, 176.3167, WB, 'western-bay-of-plenty'],
  ['3129', 'Katikati', 'Katikati', -37.5500, 175.9167, WB, 'western-bay-of-plenty'],
  ['3110', 'Tauranga Central / Otūmoetai', 'Tauranga', -37.6878, 176.1651, WB, 'tauranga-city'],
  ['3116', 'Mount Maunganui', 'Tauranga', -37.6390, 176.1850, WB, 'tauranga-city'],
  ['3010', 'Rotorua Central', 'Rotorua', -38.1368, 176.2497, WB, 'rotorua-lakes'],
  ['3120', 'Whakatāne', 'Whakatāne', -37.9530, 176.9900, WB, 'whakatane'],
  ['3127', 'Kawerau', 'Kawerau', -38.0833, 176.7000, WB, 'kawerau'],
  ['3122', 'Ōpōtiki', 'Ōpōtiki', -38.0089, 177.2871, WB, 'opotiki'],
  // Gisborne & Hawke's Bay
  ['4010', 'Gisborne Central', 'Gisborne', -38.6623, 178.0176, GH, 'gisborne'],
  ['4108', 'Wairoa', 'Wairoa', -39.0333, 177.4167, GH, 'wairoa'],
  ['4110', 'Napier South / Marewa', 'Napier', -39.4928, 176.9120, GH, 'napier-city'],
  ['4112', 'Taradale', 'Napier', -39.5330, 176.8500, GH, 'napier-city'],
  ['4120', 'Hastings Central', 'Hastings', -39.6381, 176.8492, GH, 'hastings'],
  ['4130', 'Havelock North', 'Hastings', -39.6667, 176.8833, GH, 'hastings'],
  ['4200', 'Waipukurau', 'Waipukurau', -39.9944, 176.5560, GH, 'central-hawkes-bay'],
  // Taranaki
  ['4310', 'New Plymouth Central', 'New Plymouth', -39.0556, 174.0752, TM, 'new-plymouth'],
  ['4332', 'Stratford', 'Stratford', -39.3380, 174.2840, TM, 'stratford'],
  ['4610', 'Hāwera', 'Hāwera', -39.5900, 174.2800, TM, 'south-taranaki'],
  // Manawatū-Whanganui
  ['3920', 'Taumarunui', 'Taumarunui', -38.8833, 175.2667, CP, 'ruapehu'],
  ['4625', 'Ohakune', 'Ohakune', -39.4180, 175.3990, CP, 'ruapehu'],
  ['4500', 'Whanganui Central', 'Whanganui', -39.9301, 175.0479, TM, 'whanganui'],
  ['4710', 'Marton', 'Marton', -40.0692, 175.3783, TM, 'rangitikei'],
  ['4702', 'Feilding', 'Feilding', -40.2250, 175.5650, TM, 'manawatu'],
  ['4410', 'Palmerston North Central / Hokowhitu', 'Palmerston North', -40.3523, 175.6082, TM, 'palmerston-north'],
  ['4930', 'Dannevirke', 'Dannevirke', -40.2050, 176.1000, TM, 'tararua'],
  ['5510', 'Levin', 'Levin', -40.6218, 175.2867, TM, 'horowhenua'],
  // Wellington region
  ['5032', 'Paraparaumu / Raumati', 'Paraparaumu', -40.9140, 175.0070, WH, 'kapiti-coast'],
  ['5036', 'Waikanae', 'Waikanae', -40.8750, 175.0640, WH, 'kapiti-coast'],
  ['5022', 'Porirua Central / Titahi Bay', 'Porirua', -41.1330, 174.8410, WH, 'porirua-city'],
  ['5018', 'Upper Hutt Central / Trentham', 'Upper Hutt', -41.1244, 175.0708, WH, 'upper-hutt-city'],
  ['5010', 'Lower Hutt Central / Woburn', 'Lower Hutt', -41.2127, 174.8997, WH, 'hutt-city'],
  ['5011', 'Fairfield / Epuni / Boulcott', 'Lower Hutt', -41.2015, 174.9228, WH, 'hutt-city'],
  ['5012', 'Petone / Korokoro', 'Lower Hutt', -41.2270, 174.8710, WH, 'hutt-city'],
  ['5014', 'Wainuiomata', 'Lower Hutt', -41.2600, 174.9500, WH, 'hutt-city'],
  ['6011', 'Te Aro / Wellington Central', 'Wellington', -41.2924, 174.7787, WH, 'wellington-city'],
  ['6012', 'Karori / Northland', 'Wellington', -41.2850, 174.7400, WH, 'wellington-city'],
  ['6037', 'Johnsonville', 'Wellington', -41.2230, 174.8050, WH, 'wellington-city'],
  ['5810', 'Masterton', 'Masterton', -40.9597, 175.6575, WR, 'masterton'],
  ['5713', 'Carterton', 'Carterton', -41.0250, 175.5280, WR, 'carterton'],
  ['5711', 'Martinborough', 'Martinborough', -41.2180, 175.4580, WR, 'south-wairarapa'],
  ['5794', 'Greytown', 'Greytown', -41.0800, 175.4600, WR, 'south-wairarapa'],
  // Top of the South
  ['7020', 'Richmond / Hope', 'Richmond', -41.3396, 173.1822, TS, 'tasman-district'],
  ['7120', 'Motueka', 'Motueka', -41.1080, 173.0110, TS, 'tasman-district'],
  ['7010', 'Nelson Central / The Wood', 'Nelson', -41.2706, 173.2840, TS, 'nelson-city'],
  ['7011', 'Stoke / Tāhunanui', 'Nelson', -41.3150, 173.2300, TS, 'nelson-city'],
  ['7201', 'Blenheim', 'Blenheim', -41.5134, 173.9612, TS, 'marlborough'],
  ['7220', 'Picton', 'Picton', -41.2900, 174.0060, TS, 'marlborough'],
  // West Coast
  ['7825', 'Westport', 'Westport', -41.7545, 171.6022, WC, 'buller'],
  ['7805', 'Greymouth', 'Greymouth', -42.4504, 171.2108, WC, 'grey'],
  ['7810', 'Hokitika', 'Hokitika', -42.7167, 170.9667, WC, 'westland'],
  // Canterbury
  ['7300', 'Kaikōura', 'Kaikōura', -42.4000, 173.6800, CB, 'kaikoura'],
  ['7410', 'Amberley', 'Amberley', -43.1550, 172.7300, CB, 'hurunui'],
  ['7400', 'Rangiora', 'Rangiora', -43.3040, 172.5950, CB, 'waimakariri'],
  ['7630', 'Kaiapoi', 'Kaiapoi', -43.3780, 172.6570, CB, 'waimakariri'],
  ['8011', 'Christchurch Central / Merivale', 'Christchurch', -43.5321, 172.6362, CB, 'christchurch-city'],
  ['8041', 'Riccarton / Ilam', 'Christchurch', -43.5300, 172.5900, CB, 'christchurch-city'],
  ['8081', 'Sumner / Redcliffs', 'Christchurch', -43.5680, 172.7570, CB, 'christchurch-city'],
  ['7614', 'Rolleston', 'Rolleston', -43.5960, 172.3830, CB, 'selwyn'],
  ['7608', 'Lincoln', 'Lincoln', -43.6400, 172.4860, CB, 'selwyn'],
  ['7700', 'Ashburton', 'Ashburton', -43.9030, 171.7470, CB, 'ashburton'],
  ['7910', 'Timaru', 'Timaru', -44.3970, 171.2550, CB, 'timaru'],
  ['7925', 'Fairlie', 'Fairlie', -44.1000, 170.8300, CB, 'mackenzie'],
  ['7924', 'Waimate', 'Waimate', -44.7333, 171.0500, CB, 'waimate'],
  ['9400', 'Ōamaru', 'Ōamaru', -45.0970, 170.9700, OT, 'waitaki'],
  // Otago
  ['9320', 'Alexandra', 'Alexandra', -45.2490, 169.3800, CO, 'central-otago'],
  ['9310', 'Cromwell', 'Cromwell', -45.0380, 169.2000, CO, 'central-otago'],
  ['9300', 'Queenstown', 'Queenstown', -45.0312, 168.6626, CO, 'queenstown-lakes'],
  ['9305', 'Wānaka', 'Wānaka', -44.7000, 169.1500, CO, 'queenstown-lakes'],
  ['9016', 'Dunedin North / Māori Hill', 'Dunedin', -45.8788, 170.5028, OT, 'dunedin-city'],
  ['9024', 'Mosgiel', 'Dunedin', -45.8750, 170.3480, OT, 'dunedin-city'],
  ['9230', 'Balclutha', 'Balclutha', -46.2340, 169.7400, OT, 'clutha'],
  // Southland
  ['9720', 'Winton', 'Winton', -46.1430, 168.3240, SL, 'southland-district'],
  ['9600', 'Te Anau', 'Te Anau', -45.4140, 167.7180, SL, 'southland-district'],
  ['9710', 'Gore', 'Gore', -46.1028, 168.9436, SL, 'gore'],
  ['9810', 'Invercargill Central', 'Invercargill', -46.4132, 168.3538, SL, 'invercargill-city'],
  // Chatham Islands
  ['8942', 'Waitangi', 'Chatham Islands', -43.9535, -176.5597, CI, 'chatham-islands']
];

export const NZ_POSTCODE_DIRECTORY: PostcodeLookupEntry[] = POSTCODE_ROWS.map(
  ([postcode, suburb, city, latitude, longitude, climateZoneId, councilId]) => ({
    postcode,
    suburb,
    city,
    latitude,
    longitude,
    climateZoneId,
    councilId
  })
);

/** Strips macrons/diacritics so "Whangarei" matches "Whangārei". */
export function normaliseNzText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function lookupNzLocation(query: string): PostcodeLookupEntry[] {
  const q = normaliseNzText(query);
  if (!q) return NZ_POSTCODE_DIRECTORY;
  return NZ_POSTCODE_DIRECTORY.filter((entry) => {
    if (entry.postcode.startsWith(q)) return true;
    if (normaliseNzText(entry.suburb).includes(q)) return true;
    if (normaliseNzText(entry.city).includes(q)) return true;
    const council = NZ_COUNCIL_WATER_RULES[entry.councilId];
    return council
      ? council.territories.some((t) => normaliseNzText(t).includes(q))
      : false;
  });
}
