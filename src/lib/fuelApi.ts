/**
 * Thai Oil Price API (via api.chnwt.dev)
 * Endpoint: https://api.chnwt.dev/thai-oil-api/latest
 * Returns: { status, response: { date, stations: { ptt: { diesel, gasohol_91, gasohol_95, gasohol_e20, ... } } } }
 *
 * Strategy: cache the entire API response in localStorage keyed by local
 * Thai date (YYYY-MM-DD). Cache is refreshed once per day — either when
 * the date changes naturally (crossing 00:00) or on first load of a new day.
 *
 * Using PTT station prices.
 */

const API_URL   = 'https://api.chnwt.dev/thai-oil-api/latest';
const CACHE_KEY = 'gbdriver_fuel_cache';

// Fallback prices (THB/litre, updated May 2025)
const FALLBACK: Record<string, number> = {
  diesel: 33.44,
  '91':   35.48,
  '95':   35.75,
  e20:    33.44,
};

// Map our fuelType key → PTT station field name in the API response
const PTT_KEY_MAP: Record<string, string> = {
  diesel: 'diesel',
  '91':   'gasohol_91',
  '95':   'gasohol_95',
  e20:    'gasohol_e20',
};

interface PttFuelEntry {
  name?: string;
  price?: string | number;
}

interface ApiResponse {
  status?: string;
  response?: {
    date?: string;
    stations?: {
      ptt?: Record<string, PttFuelEntry>;
      [station: string]: Record<string, PttFuelEntry> | undefined;
    };
  };
}

interface FuelCache {
  date: string;          // local YYYY-MM-DD the data was fetched for
  data: ApiResponse;
}

// Local date string (YYYY-MM-DD) in Thai timezone (UTC+7)
function localDateStr(): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  return d.toISOString().slice(0, 10);
}

// Load valid cache for today, or fetch fresh data from the API
async function loadFreshData(): Promise<ApiResponse> {
  const today = localDateStr();

  // Read cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache: FuelCache = JSON.parse(raw);
      if (cache.date === today && cache.data?.response?.stations?.ptt) {
        return cache.data;
      }
    }
  } catch { /* corrupt cache — ignore */ }

  // Fetch from API
  const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: ApiResponse = await res.json();
  if (data.status !== 'success' || !data.response?.stations?.ptt) {
    throw new Error('Unexpected API response shape');
  }

  // Persist cache
  try {
    const cache: FuelCache = { date: today, data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full — skip */ }

  return data;
}

export async function getFuelPrice(fuelType: 'diesel' | '91' | '95' | 'e20'): Promise<number> {
  try {
    const apiData = await loadFreshData();
    const ptt     = apiData.response?.stations?.ptt;
    const key     = PTT_KEY_MAP[fuelType];
    if (ptt && key && ptt[key]) {
      const raw   = ptt[key].price;
      const price = parseFloat(String(raw ?? ''));
      if (!isNaN(price) && price > 0) return price;
    }
    return FALLBACK[fuelType];
  } catch (err) {
    console.warn('Thai Oil API failed, using fallback price:', err);
    return FALLBACK[fuelType];
  }
}

/** Call this once at app startup / midnight to pre-warm the cache. */
export async function prefetchFuelPrices(): Promise<void> {
  try { await loadFreshData(); } catch { /* silent */ }
}
