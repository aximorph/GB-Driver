/**
 * Bangchak Oil Price API
 * Endpoint: https://oil-price.bangchak.co.th/ApiOilPrice2/en  (or /th)
 * Returns array of { OilName, PriceToday, PriceYesterday, PriceTomorrow, ... }
 *
 * Strategy: use PriceTomorrow (already-announced next-day price) so the
 * price stays current. Cache the entire API response in localStorage keyed
 * by local date (YYYY-MM-DD). The cache is refreshed once per day — either
 * when the date changes naturally (crossing 00:00) or on first load of a
 * new day.
 */

const API_URL     = 'https://oil-price.bangchak.co.th/ApiOilPrice2/en';
const CACHE_KEY   = 'gbdriver_fuel_cache';

// Fallback prices (THB, updated May 2025)
const FALLBACK: Record<string, number> = {
  diesel: 33.44,
  '91': 37.00,
  '95': 39.00,
  e20: 35.45,
};

interface BangchakItem {
  OilName?: string;
  PriceToday?: string | number;
  PriceYesterday?: string | number;
  PriceTomorrow?: string | number;
  [key: string]: unknown;
}

interface FuelCache {
  date: string;               // local YYYY-MM-DD the data was fetched for
  data: BangchakItem[];
}

// Local date string (YYYY-MM-DD) in Thai timezone (UTC+7)
function localDateStr(): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  return d.toISOString().slice(0, 10);
}

// Map Bangchak OilName → our fuelType key
function matchFuelType(oilName: string, fuelType: string): boolean {
  const name = oilName.toLowerCase();
  switch (fuelType) {
    case 'diesel': return name.includes('diesel') || name.includes('hsd');
    case '91':     return name.includes('91') && !name.includes('95') && !name.includes('e');
    case '95':     return name.includes('95') && !name.includes('e');
    case 'e20':    return name.includes('e20') || name.includes('e 20');
    default:       return false;
  }
}

function extractPrice(item: BangchakItem): number | null {
  // Prefer PriceTomorrow; fall back to PriceToday if tomorrow is null/empty/0
  for (const field of ['PriceTomorrow', 'PriceToday'] as const) {
    const raw = item[field];
    if (raw === undefined || raw === null || raw === '' || raw === '0') continue;
    const price = parseFloat(String(raw));
    if (!isNaN(price) && price > 0) return price;
  }
  return null;
}

// Load valid cache for today, or fetch fresh data from the API
async function loadFreshData(): Promise<BangchakItem[]> {
  const today = localDateStr();

  // Read cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache: FuelCache = JSON.parse(raw);
      if (cache.date === today && Array.isArray(cache.data) && cache.data.length > 0) {
        return cache.data;
      }
    }
  } catch { /* corrupt cache — ignore */ }

  // Fetch from API
  const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: BangchakItem[] = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('Empty response');

  // Persist cache
  try {
    const cache: FuelCache = { date: today, data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full — skip */ }

  return data;
}

export async function getFuelPrice(fuelType: 'diesel' | '91' | '95' | 'e20'): Promise<number> {
  try {
    const data  = await loadFreshData();
    const match = data.find(item => item.OilName && matchFuelType(item.OilName, fuelType));
    if (match) {
      const price = extractPrice(match);
      if (price !== null) return price;
    }
    return FALLBACK[fuelType];
  } catch (err) {
    console.warn('Bangchak API failed, using fallback price:', err);
    return FALLBACK[fuelType];
  }
}

/** Call this once at app startup / midnight to pre-warm the cache. */
export async function prefetchFuelPrices(): Promise<void> {
  try { await loadFreshData(); } catch { /* silent */ }
}
