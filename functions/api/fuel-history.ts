/**
 * GET /api/fuel-history
 *
 * Serves an accumulating daily history of Thai retail fuel prices, used to
 * draw the "fuel price history" line chart on the Analytics page.
 *
 * There is no free historical-price API available (the public source we use
 * for live prices, api.chnwt.dev/thai-oil-api/latest, only ever returns
 * "today's" snapshot — see src/lib/fuelApi.ts). So instead of a scheduled
 * cron job (Cloudflare Pages Functions do not support Cron Triggers — only
 * standalone Workers do, which would require a second, separately-deployed
 * resource), this endpoint takes an "opportunistic snapshot" approach:
 *
 *   1. Read the accumulated history array out of KV.
 *   2. If there is no entry yet for *today* (Thai local date), fetch the
 *      live API once, normalize it, and append+persist it.
 *   3. Return the full history (capped to ~2 years) as JSON.
 *
 * Because this runs on every request, and the app calls it once on launch
 * (see src/components/Dashboard.tsx) in addition to whenever the Analytics
 * page is open, in practice a snapshot lands almost every day the app is
 * used at all — no separate cron infrastructure required.
 *
 * Requires a KV namespace bound as `GBDRIVER_FUEL_HISTORY` on the Pages
 * project (Settings → Functions → KV namespace bindings).
 */

interface Env {
  GBDRIVER_FUEL_HISTORY: KVNamespace;
}

const API_URL = 'https://api.chnwt.dev/thai-oil-api/latest';
const HISTORY_KEY = 'history';
const MAX_DAYS = 730; // ~2 years of daily snapshots

// Canonical fuel-type keys we track, and how each station names that same
// product in the upstream API (field names are inconsistent station-to-
// station — e.g. Bangchak misspells "diesel" as "disel", Shell brands its
// diesel as "vpower_diesel", etc).
const STATION_FIELD_MAP: Record<string, Record<string, string>> = {
  ptt: {
    gasoline_95: 'gasoline_95', gasohol_95: 'gasohol_95', gasohol_91: 'gasohol_91',
    gasohol_e20: 'gasohol_e20', gasohol_e85: 'gasohol_e85', diesel: 'diesel',
    premium_diesel: 'premium_diesel', premium_gasohol_95: 'superpower_gasohol_95',
  },
  bcp: {
    gasohol_95: 'gasohol_95', gasohol_91: 'gasohol_91', gasohol_e20: 'gasohol_e20',
    gasohol_e85: 'gasohol_e85', diesel: 'disel',
    premium_diesel: 'premium_diesel', premium_gasohol_95: 'premium_gasohol_95',
  },
  shell: {
    gasohol_95: 'gasohol_95', gasohol_91: 'gasohol_91', gasohol_e20: 'gasohol_e20',
    diesel: 'vpower_diesel', premium_gasohol_95: 'vpower_gasohol_95',
  },
  caltex: {
    gasoline_95: 'gasoline_95', gasohol_95: 'gasohol_95', gasohol_91: 'gasohol_91',
    gasohol_e20: 'gasohol_e20', diesel: 'diesel', premium_diesel: 'premium_diesel',
  },
  irpc: {
    gasohol_95: 'gasohol_95', gasohol_91: 'gasohol_91', diesel: 'diesel',
  },
  pt: {
    gasoline_95: 'gasoline_95', gasohol_95: 'gasohol_95', gasohol_91: 'gasohol_91',
    gasohol_e20: 'gasohol_e20', diesel: 'diesel',
  },
  susco: {
    gasoline_95: 'gasoline_95', gasohol_95: 'gasohol_95', gasohol_91: 'gasohol_91',
    gasohol_e20: 'gasohol_e20', diesel: 'diesel',
  },
  pure: {
    gasohol_95: 'gasohol_95', gasohol_91: 'gasohol_91', gasohol_e20: 'gasohol_e20',
    diesel: 'diesel',
  },
};

export const FUEL_TYPES = [
  'gasoline_95', 'gasohol_95', 'gasohol_91', 'gasohol_e20', 'gasohol_e85',
  'diesel', 'premium_diesel', 'premium_gasohol_95',
] as const;

export const STATIONS = Object.keys(STATION_FIELD_MAP);

interface ApiEntry { name?: string; price?: string | number; }
interface ApiResponse {
  status?: string;
  response?: { stations?: Record<string, Record<string, ApiEntry>> };
}

interface HistoryEntry {
  date: string; // YYYY-MM-DD, Thai local date
  stations: Record<string, Partial<Record<string, number>>>;
}

function localDateStr(): string {
  const d = new Date(Date.now() + 7 * 3600_000); // UTC+7
  return d.toISOString().slice(0, 10);
}

function buildEntryFromApi(data: ApiResponse, date: string): HistoryEntry {
  const stations: HistoryEntry['stations'] = {};
  const apiStations = data.response?.stations ?? {};

  for (const [stationKey, fieldMap] of Object.entries(STATION_FIELD_MAP)) {
    const apiStation = apiStations[stationKey];
    if (!apiStation) continue;
    const prices: Partial<Record<string, number>> = {};
    for (const [ourKey, apiField] of Object.entries(fieldMap)) {
      const raw = apiStation[apiField]?.price;
      const price = parseFloat(String(raw ?? ''));
      if (!isNaN(price) && price > 0) prices[ourKey] = price;
    }
    if (Object.keys(prices).length > 0) stations[stationKey] = prices;
  }

  return { date, stations };
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const today = localDateStr();

    let history: HistoryEntry[] = [];
    try {
      const raw = await env.GBDRIVER_FUEL_HISTORY.get(HISTORY_KEY);
      if (raw) history = JSON.parse(raw);
    } catch { /* corrupt/missing — start fresh */ }

    const hasToday = history.some(h => h.date === today);

    if (!hasToday) {
      try {
        const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const data: ApiResponse = await res.json();
          if (data.status === 'success' && data.response?.stations) {
            const entry = buildEntryFromApi(data, today);
            // Filter+push (rather than blind push) so a rare concurrent
            // double-write still converges to exactly one entry per day.
            history = history.filter(h => h.date !== today);
            history.push(entry);
            history.sort((a, b) => a.date.localeCompare(b.date));
            if (history.length > MAX_DAYS) history = history.slice(-MAX_DAYS);
            await env.GBDRIVER_FUEL_HISTORY.put(HISTORY_KEY, JSON.stringify(history));
          }
        }
      } catch { /* live fetch failed — just serve what we already have */ }
    }

    return new Response(JSON.stringify(history), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800', // 30 min edge cache
      },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
