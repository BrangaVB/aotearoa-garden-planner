import { PestGuideEntry } from '../types/domain';

export const NZ_PEST_DISEASE_GUIDE: PestGuideEntry[] = [
  {
    id: 'tomato-potato-psyllid',
    name: 'Tomato Potato Psyllid (TPP)',
    type: 'Insect Pest',
    hostPlants: ['Tomato', 'Potato', 'Tamarillo', 'Kumara'],
    peakMonthsNZ: [11, 12, 1, 2, 3, 4],
    symptoms: 'Upward curling and yellowing/purpling of top leaves ("psyllid yellows"), white sugar-like crystals on foliage, stunted fruit.',
    organicRemedy: 'Spray undersides of leaves with neem oil or organic pyrethrum at dusk; exclude with fine insect mesh (0.8mm) early in season.',
    standardRemedy: 'Apply Yates Mavrik or spinosad-based spray in the evening to protect bees.',
    preventionTip: 'Remove nearby woolly nightshade weeds which act as winter breeding hosts in NZ.'
  },
  {
    id: 'passionvine-hopper',
    name: 'Passionvine Hopper',
    teReoOrAltName: 'Fluffy Bum (nymph stage)',
    type: 'Insect Pest',
    hostPlants: ['Passionfruit', 'Feijoa', 'Citrus', 'Tomato', 'Beans', 'NZ Natives'],
    peakMonthsNZ: [12, 1, 2, 3],
    symptoms: 'White fluffy-tailed nymphs jumping off stems, sticky honeydew on leaves followed by black sooty mould.',
    organicRemedy: 'Blast nymphs off stems with a sharp jet of water in morning, or spray potassium soap / neem oil onto young nymphs.',
    standardRemedy: 'Apply systemic or contact garden insecticide before adults develop wings in January.',
    preventionTip: 'Prune dense inner foliage on feijoas and vines in winter to improve airflow.'
  },
  {
    id: 'guava-moth',
    name: 'Guava Moth',
    type: 'Insect Pest',
    hostPlants: ['Feijoa', 'Citrus', 'Macadamia', 'Plum', 'Peach'],
    peakMonthsNZ: [1, 2, 3, 4, 5],
    symptoms: 'Small pinholes on skin with frass (sawdust-like droppings); pinkish caterpillar tunnelling inside ripening fruit.',
    organicRemedy: 'Hang pheromone traps from November; pick up and destroy all fallen fruit daily (do not cold-compost).',
    standardRemedy: 'Cover trees with fine exclusion netting post-blossom or apply targeted codling/guava moth spray.',
    preventionTip: 'Keep ground under feijoa and citrus trees clean of windfalls throughout autumn.'
  },
  {
    id: 'cabbage-white-butterfly',
    name: 'Cabbage White Butterfly',
    type: 'Insect Pest',
    hostPlants: ['Cabbage', 'Broccoli', 'Kale', 'Cauliflower', 'Pak Choi'],
    peakMonthsNZ: [10, 11, 12, 1, 2, 3, 4],
    symptoms: 'Ragged holes chewed through brassica leaves, dark green droppings, camouflaged velvety green caterpillars.',
    organicRemedy: 'Spray Bacillus thuringiensis (BT / Dipel) or neem oil; interplant with French marigolds and white decoy butterflies.',
    standardRemedy: 'Apply derris dust or spinosad.',
    preventionTip: 'Hoops + fine insect netting from planting day is the single most effective NZ defence.'
  },
  {
    id: 'late-blight',
    name: 'Late Blight',
    type: 'Fungal/Oomycete Disease',
    hostPlants: ['Tomato', 'Potato'],
    peakMonthsNZ: [1, 2, 3, 4],
    symptoms: 'Dark brown/black water-soaked blotches on leaves and stems spreading rapidly after warm humid rain; firm brown rot on fruit.',
    organicRemedy: 'Immediately remove and bin affected leaves (never compost); apply preventative liquid copper spray before wet weather.',
    standardRemedy: 'Apply copper oxychloride or mancozeb preventative fungicide.',
    preventionTip: 'Water soil at base—never wet leaves—and prune lower 30cm of tomato foliage for airflow.'
  },
  {
    id: 'slugs-and-snails',
    name: 'Slugs & Garden Snails',
    type: 'Mollusc',
    hostPlants: ['Seedlings', 'Silverbeet', 'Lettuce', 'Beans', 'Hosta'],
    peakMonthsNZ: [4, 5, 6, 7, 8, 9, 10, 11],
    symptoms: 'Irregular holes in tender seedlings overnight accompanied by silvery slime trails.',
    organicRemedy: 'Scatter iron-phosphate baits (pet- and bird-safe, e.g. Quash), set sunken beer traps, or copper tape around raised beds.',
    standardRemedy: 'Apply pet-safe iron EDTA pellets sparingly around vulnerable transplants.',
    preventionTip: 'Water in the morning rather than late evening so soil surfaces dry before nightfall.'
  },
  {
    id: 'codling-moth',
    name: 'Codling Moth',
    type: 'Insect Pest',
    hostPlants: ['Apple', 'Pear', 'Nashi Pear', 'Walnut'],
    peakMonthsNZ: [10, 11, 12, 1, 2],
    symptoms: 'Entry holes in developing apples/pears plugged with reddish-brown frass; pinkish-white larvae tunnelling to the core.',
    organicRemedy: 'Hang pheromone traps from October to monitor flights; wrap corrugated cardboard bands around trunks in December and destroy pupae.',
    standardRemedy: 'Apply targeted codling moth spray at petal fall and repeat every 14 days during peak flight.',
    preventionTip: 'Pick up and bin all windfall fruit immediately; scrape loose winter bark where larvae overwinter.'
  },
  {
    id: 'bronze-beetle',
    name: 'Bronze Beetle',
    teReoOrAltName: 'Kākiwai / Native Scarab',
    type: 'Insect Pest',
    hostPlants: ['Apple', 'Feijoa', 'Blueberry', 'Roses', 'Kōwhai', 'Silverbeet'],
    peakMonthsNZ: [11, 12, 1],
    symptoms: 'Shot-hole chewing on young leaves and petals in late spring/early summer; beetles drop to the ground when disturbed.',
    organicRemedy: 'Shake beetles onto a sheet at dawn while sluggish, or spray neem oil/pyrethrum in the evening when bees are inactive.',
    standardRemedy: 'Apply Yates Mavrik at dusk on severe infestations.',
    preventionTip: 'Encourage starlings and blackbirds in winter to eat grass-grub larvae in lawns; avoid disturbing soil near roots at dusk.'
  },
  {
    id: 'powdery-mildew',
    name: 'Powdery Mildew',
    type: 'Fungal/Oomycete Disease',
    hostPlants: ['Zucchini', 'Cucumber', 'Pumpkin', 'Peas', 'Apple', 'Rose'],
    peakMonthsNZ: [1, 2, 3, 4],
    symptoms: 'White flour-like powdery coating on upper leaf surfaces, yellowing and premature leaf drop in late summer.',
    organicRemedy: 'Spray a 1:9 milk-to-water solution or potassium bicarbonate (Eco-Fungicide) weekly in sunny weather.',
    standardRemedy: 'Apply wettable sulphur or systemic rose/vege fungicide.',
    preventionTip: 'Water at root level in the morning, space plants for airflow, and avoid excess nitrogen in late summer.'
  }
];
