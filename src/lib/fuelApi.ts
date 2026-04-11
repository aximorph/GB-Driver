// Bangchak Oil Price API – returns array of { PriceDate, ProductName, Price, ... }
const API_URL = 'https://oil-price.bangchak.co.th/ApiOilPrice2/en';

// Fallback prices (THB, updated Apr 2025)
const FALLBACK: Record<string, number> = {
  diesel: 32.94,
  '91': 36.48,
  '95': 36.75,
  e20: 34.44,
};

interface BangchakItem {
  PriceDate?: string;
  ProductName?: string;
  Price?: string | number;
  [key: string]: unknown;
}

// Map Bangchak ProductName → our fuelType key
function matchFuelType(productName: string, fuelType: string): boolean {
  const name = productName.toLowerCase();
  switch (fuelType) {
    case 'diesel':
      return name.includes('diesel');
    case '91':
      return name.includes('91') && !name.includes('95');
    case '95':
      return name.includes('95');
    case 'e20':
      return name.includes('e20') || name.includes('e 20');
    default:
      return false;
  }
}

export async function getFuelPrice(fuelType: 'diesel' | '91' | '95' | 'e20'): Promise<number> {
  try {
    const res = await fetch(API_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json: BangchakItem[] = await res.json();

    if (Array.isArray(json)) {
      const match = json.find(item =>
        item.ProductName && matchFuelType(item.ProductName, fuelType)
      );
      if (match && match.Price !== undefined && match.Price !== null) {
        const price = parseFloat(String(match.Price));
        if (!isNaN(price) && price > 0) return price;
      }
    }

    // If no match found, return fallback
    return FALLBACK[fuelType];
  } catch (err) {
    console.warn('Bangchak API failed, using fallback price:', err);
    return FALLBACK[fuelType];
  }
}
