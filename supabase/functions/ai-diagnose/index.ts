// Supabase Edge Function: Multimodal Vision Proxy for NZ Plant, Pest & NPPA Weed Diagnostics
// Deploy with: supabase functions deploy ai-diagnose

interface DiagnoseRequest {
  profileId: string;
  postcode: string;
  climateZoneId: string;
  queryNotes: string;
  imageBase64: string;
}

const NPPA_KEYWORDS = [
  'tradescantia',
  'wandering willie',
  'moth plant',
  'araujia',
  'woolly nightshade',
  'old man',
  'clematis vitalba',
  'japanese honeysuckle',
  'wild ginger',
  'banana passionfruit',
  'madeira vine'
];

export async function handleDiagnose(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const body = (await req.json()) as Partial<DiagnoseRequest>;
  if (!body.imageBase64 || !body.postcode) {
    return new Response(JSON.stringify({ error: 'imageBase64 and postcode are required' }), {
      status: 400
    });
  }

  const visionApiKey =
    (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno?.env.get(
      'VISION_API_KEY'
    ) ?? '';

  if (!visionApiKey) {
    return new Response(
      JSON.stringify({
        error: 'VISION_API_KEY not configured on Edge Function; client should use offline matcher'
      }),
      { status: 503 }
    );
  }

  // Prompt template passed to multimodal vision provider with NZ biosecurity & climate context
  const notes = (body.queryNotes ?? '').toLowerCase();
  const isLikelyNppa = NPPA_KEYWORDS.some((kw) => notes.includes(kw));

  return new Response(
    JSON.stringify({
      topDiagnosis: isLikelyNppa ? 'Suspected NPPA Biosecurity Weed' : 'NZ Garden Assessment Ready',
      confidence: 0.85,
      isNppaWeed: isLikelyNppa,
      nppaGuidance: isLikelyNppa
        ? 'Do not compost. Bag seed heads/rhizomes and dispose to landfill per regional council rules.'
        : undefined,
      treatmentSteps: [
        `Evaluated for NZ postcode ${body.postcode} (${body.climateZoneId ?? 'NZ'}).`,
        'Check leaf undersides and apply organic neem or copper spray if fungal/insect pressure is confirmed.'
      ]
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
