// Supabase Edge Function: Automated NZ Council Water Restriction Feed Checker
// Deploy with: supabase functions deploy sync-council-rules

interface CouncilFeedTarget {
  councilId: string;
  councilName: string;
  sourceUrl: string;
}

const MAJOR_COUNCIL_FEEDS: CouncilFeedTarget[] = [
  {
    councilId: 'auckland',
    councilName: 'Auckland Council (Watercare)',
    sourceUrl: 'https://www.watercare.co.nz/water-and-wastewater/water-restrictions'
  },
  {
    councilId: 'wellington-city',
    councilName: 'Wellington City Council (Wellington Water)',
    sourceUrl: 'https://www.wellingtonwater.co.nz/your-water/water-restrictions/'
  },
  {
    councilId: 'christchurch-city',
    councilName: 'Christchurch City Council',
    sourceUrl: 'https://ccc.govt.nz/services/water-and-drainage/water-supply/water-restrictions'
  },
  {
    councilId: 'tauranga-city',
    councilName: 'Tauranga City Council',
    sourceUrl: 'https://www.tauranga.govt.nz/living/water/water-restrictions'
  },
  {
    councilId: 'queenstown-lakes-district',
    councilName: 'Queenstown Lakes District Council',
    sourceUrl: 'https://www.qldc.govt.nz/services/water-services/water-restrictions'
  }
];

export function parseRestrictionLevelFromHtml(html: string): 0 | 1 | 2 | 3 | 4 | null {
  const lower = html.toLowerCase();
  if (lower.includes('level 4') || lower.includes('total outdoor ban')) return 4;
  if (lower.includes('level 3') || lower.includes('hand-held hose ban')) return 3;
  if (lower.includes('level 2') || lower.includes('sprinkler ban')) return 2;
  if (lower.includes('level 1') || lower.includes('alternate days')) return 1;
  if (lower.includes('no water restrictions') || lower.includes('level 0')) return 0;
  return null;
}

export async function handleCouncilSync(req: Request): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const results = await Promise.all(
    MAJOR_COUNCIL_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.sourceUrl, { method: 'GET' });
        if (!res.ok) {
          return { ...feed, status: 'unreachable', detectedLevel: null };
        }
        const html = await res.text();
        const detectedLevel = parseRestrictionLevelFromHtml(html);
        return {
          ...feed,
          status: 'checked',
          detectedLevel,
          checkedAtIso: new Date().toISOString()
        };
      } catch {
        return { ...feed, status: 'error', detectedLevel: null };
      }
    })
  );

  return new Response(
    JSON.stringify({
      checkedCount: results.length,
      results
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

const denoServe = (globalThis as { Deno?: { serve?: (fn: (req: Request) => Promise<Response>) => void } })
  .Deno?.serve;
if (denoServe) {
  denoServe(handleCouncilSync);
}
