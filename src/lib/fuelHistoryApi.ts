/**
 * Client for /api/fuel-history — the accumulating daily fuel-price history
 * used by the Analytics "fuel price history" chart.
 *
 * Snapshots are collected server-side by this Worker's own `scheduled`
 * handler (see worker/index.ts at the repo root) that writes directly to D1
 * once a day, independent of app traffic. This endpoint (the same Worker's
 * `/api/fuel-history` route) is a plain read-only query against that same D1
 * database — it has no side effects.
 * All this module does is fetch the resulting array and cache it briefly in
 * memory so multiple components mounting at once don't double-fetch.
 */

export type FuelType =
  | 'gasoline_95' | 'gasohol_95' | 'gasohol_91' | 'gasohol_e20' | 'gasohol_e85'
  | 'diesel' | 'premium_diesel' | 'premium_gasohol_95';

export interface FuelHistoryEntry {
  date: string; // YYYY-MM-DD
  stations: Record<string, Partial<Record<FuelType, number>>>;
}

const ENDPOINT = '/api/fuel-history';

let inFlight: Promise<FuelHistoryEntry[]> | null = null;

/** Fetch the full accumulated fuel-price history (read-only; snapshots are written by the cron Worker). */
export async function getFuelHistory(): Promise<FuelHistoryEntry[]> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data as FuelHistoryEntry[] : [];
    } catch (err) {
      console.warn('Fuel history fetch failed:', err);
      return [];
    } finally {
      // Allow a fresh fetch next time (don't cache failures/results forever).
      setTimeout(() => { inFlight = null; }, 0);
    }
  })();
  return inFlight;
}
