/**
 * gb-driver — main Worker entry-point
 *
 * This project used to be a classic Cloudflare Pages project (static build +
 * auto-discovered Pages Functions under functions/). Once Workers Builds CI
 * was enabled, Cloudflare re-platformed it as a Worker + static assets
 * project, which does NOT support Pages Functions' file-based routing — so
 * all dynamic routes have to be handled explicitly here instead.
 *
 * Routing (fetch): any request that doesn't match a static file in dist/ is
 * passed to this fetch handler (see assets.not_found_handling in
 * wrangler.jsonc for SPA fallback behavior). We handle our one dynamic route
 * (/api/fuel-history) directly, and forward everything else to the ASSETS
 * binding, which serves the matching static file or — for unmatched
 * client-side routes like /analytics — falls back to index.html via
 * not_found_handling.
 *
 * Scheduling (scheduled): once a day at midnight Thai time (see
 * triggers.crons in wrangler.jsonc), fetches live retail fuel prices and
 * writes one row per (station, fuel_type) into D1 — independent of whether
 * anyone actually opens the app that day. /api/fuel-history just reads from
 * this same table. This used to live in a separate standalone Worker
 * (workers/fuel-cron) because Pages Functions don't support Cron Triggers —
 * now that this project is a real Worker, that split is no longer necessary,
 * so both jobs live in this one Worker + wrangler.jsonc.
 */

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
}

// ---------------------------------------------------------------------------
// fetch: /api/fuel-history (read)
// ---------------------------------------------------------------------------

const MAX_MONTHS = 24; // matches the longest range option in the Analytics chart

interface FuelHistoryRow {
  date: string;
  station: string;
  fuel_type: string;
  price: number;
}

interface HistoryEntry {
  date: string; // YYYY-MM-DD, Thai local date
  stations: Record<string, Partial<Record<string, number>>>;
}

function cutoffDateStr(): string {
  const d = new Date(Date.now() + 7 * 3600_000); // Thai local "today"
  d.setMonth(d.getMonth() - MAX_MONTHS);
  return d.toISOString().slice(0, 10);
}

async function handleFuelHistory(env: Env): Promise<Response> {
  try {
    const cutoff = cutoffDateStr();
    const { results } = await env.DB.prepare(
      'SELECT date, station, fuel_type, price FROM fuel_history WHERE date >= ? ORDER BY date ASC'
    )
      .bind(cutoff)
      .all<FuelHistoryRow>();

    const byDate = new Map<string, HistoryEntry>();
    for (const row of results ?? []) {
      let entry = byDate.get(row.date);
      if (!entry) {
        entry = { date: row.date, stations: {} };
        byDate.set(row.date, entry);
      }
      (entry.stations[row.station] ??= {})[row.fuel_type] = row.price;
    }

    const history = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    return new Response(JSON.stringify(history), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800', // 30 min edge cache
      },
    });
  } catch (err) {
    console.error('fuel-history query failed:', err);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ---------------------------------------------------------------------------
// scheduled: daily fuel price snapshot (write)
// ---------------------------------------------------------------------------

const FUEL_API_URL = 'https://api.chnwt.dev/thai-oil-api/latest';

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
  const res = await fetch(FUEL_API_URL, { headers: { Accept: 'application/json' } });
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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/fuel-history') {
      return handleFuelHistory(env);
    }

    if (url.pathname === '/api/fuel-history/snapshot-now') {
      // Manual trigger for testing/backfilling "today" on demand — hit this
      // URL with a plain GET request. Runs the exact same logic as the
      // scheduled handler below.
      try {
        const { date, rows } = await snapshotToD1(env);
        return new Response(`OK — snapshot recorded for ${date} (${rows} rows written/ignored)\n`, {
          status: 200,
        });
      } catch (err) {
        return new Response(`Error: ${(err as Error).message}\n`, { status: 500 });
      }
    }

    // No custom route matched — hand off to the static asset server. For
    // genuinely missing assets (e.g. a client-side route like /analytics),
    // not_found_handling: "single-page-application" in wrangler.jsonc makes
    // this resolve to index.html instead of a raw 404.
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      snapshotToD1(env).catch(err => {
        // Cron failures are silent by nature (nobody's watching) — at least
        // surface them in `wrangler tail` / dashboard logs.
        console.error('fuel snapshot failed:', err);
      })
    );
  },
} satisfies ExportedHandler<Env>;
