/**
 * GET /api/fuel-history
 *
 * Serves an accumulating daily history of Thai retail fuel prices, used to
 * draw the "fuel price history" line chart on the Analytics page.
 *
 * This endpoint is read-only. Snapshots are written by a separate,
 * standalone cron Worker (workers/fuel-cron) that runs once a day at
 * midnight Thai time and writes directly into D1 — independent of whether
 * anyone actually opens the app that day. All this endpoint does is query
 * that same D1 database and reshape the rows into the array-of-days shape
 * the chart expects.
 *
 * Requires a D1 database bound as `DB` on the Pages project (same
 * database_id as workers/fuel-cron/wrangler.jsonc — see that folder for
 * setup/migration instructions).
 */

interface Env {
  DB: D1Database;
}

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

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
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
};
