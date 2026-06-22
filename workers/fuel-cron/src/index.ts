/**
 * gbdriver-fuel-cron
 *
 * Standalone Worker (NOT a Pages Function — those don't support Cron
 * Triggers) that runs once a day and records that day's retail fuel prices
 * into D1. The main Pages project's /api/fuel-history endpoint just reads
 * from this same D1 database — it no longer fetches the live API or writes
 * anything itself.
 *
 * Deploy separately from the Pages project:
 *   cd workers/fuel-cron
 *   npm install
 *   npm run db:create        # first time only — then paste the database_id
 *                             # into wrangler.jsonc (this file's AND the
 *                             # root project's wrangler.jsonc)
 *   npm run db:migrate       # creates the fuel_history table
 *   npm run deploy
 *
 * To verify it actually works without waiting for the next midnight, hit
 * the deployed Worker's URL once with a plain GET request — the `fetch`
 * handler below runs the exact same snapshot logic as the cron trigger.
 */

export interface Env {
  DB: D1Database;
}

const API_URL = 'https://api.chnwt.dev/thai-oil-api/latest';

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

interface ApiEntry { name?: string; price?: string | number; }
interface ApiResponse {
  status?: string;
  response?: { stations?: Record<string, Record<string, ApiEntry>> };
}

function localDateStr(): string {
  const d = new Date(Date.now() + 7 * 3600_000); // UTC+7 (Thai local date)
  return d.toISOString().slice(0, 10);
}

/** Fetches today's live prices and writes one row per (station, fuel_type) into D1. Idempotent — safe to call more than once for the same day. */
async function snapshotToD1(env: Env): Promise<{ date: string; rows: number }> {
  const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Upstream API returned HTTP ${res.status}`);

  const data: ApiResponse = await res.json();
  if (data.status !== 'success' || !data.response?.stations) {
    throw new Error('Upstream API returned an unexpected payload shape');
  }

  const date = localDateStr();
  const apiStations = data.response.stations;
  const statements: D1PreparedStatement[] = [];

  for (const [stationKey, fieldMap] of Object.entries(STATION_FIELD_MAP)) {
    const apiStation = apiStations[stationKey];
    if (!apiStation) continue;

    for (const [ourKey, apiField] of Object.entries(fieldMap)) {
      const raw = apiStation[apiField]?.price;
      const price = parseFloat(String(raw ?? ''));
      if (isNaN(price) || price <= 0) continue;

      statements.push(
        env.DB
          .prepare(
            'INSERT OR IGNORE INTO fuel_history (date, station, fuel_type, price) VALUES (?, ?, ?, ?)'
          )
          .bind(date, stationKey, ourKey, price)
      );
    }
  }

  if (statements.length > 0) await env.DB.batch(statements);
  return { date, rows: statements.length };
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      snapshotToD1(env).catch(err => {
        // Cron failures are silent by nature (nobody's watching) — at least
        // surface them in `wrangler tail` / dashboard logs.
        console.error('fuel-cron snapshot failed:', err);
      })
    );
  },

  // Manual trigger for testing/backfilling "today" on demand — just visit
  // the deployed Worker's URL with a plain GET request. Runs the exact same
  // logic as the scheduled handler above.
  async fetch(_request: Request, env: Env): Promise<Response> {
    try {
      const { date, rows } = await snapshotToD1(env);
      return new Response(`OK — snapshot recorded for ${date} (${rows} rows written/ignored)\n`, {
        status: 200,
      });
    } catch (err) {
      return new Response(`Error: ${(err as Error).message}\n`, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
