import { db } from './firebase';
import { ref, set, remove, onValue, type DatabaseReference } from 'firebase/database';

const TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Stable SESSION_ID across page reloads (same Firebase node survives eviction)
const SESSION_ID = (() => {
  const KEY = 'gbdriver_session_id';
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  localStorage.setItem(KEY, id);
  return id;
})();

const PROVINCE_KEY = 'gbdriver_presence_province';

let presenceRef: DatabaseReference | null = null;

/** Call when driver starts a shift. Saves province so we can recover after reload. */
export function goOnline(provinceId: string): void {
  localStorage.setItem(PROVINCE_KEY, provinceId);
  presenceRef = ref(db, `presence/${provinceId}/${SESSION_ID}`);
  set(presenceRef, { ts: Date.now() });
}

/**
 * Call on Dashboard mount.
 * If the page was evicted and reloaded mid-shift, this reconstructs presenceRef
 * from localStorage and immediately writes a fresh timestamp.
 */
export function initPresence(): void {
  if (presenceRef) return; // already initialised this session
  const province = localStorage.getItem(PROVINCE_KEY);
  if (!province) return; // not on shift
  presenceRef = ref(db, `presence/${province}/${SESSION_ID}`);
  set(presenceRef, { ts: Date.now() });
}

/** Call on any user activity while on shift. No-op if not on shift. */
export function updatePresence(): void {
  if (!presenceRef) return;
  set(presenceRef, { ts: Date.now() });
}

/** Call when driver ends a shift. */
export function goOffline(): void {
  localStorage.removeItem(PROVINCE_KEY);
  if (presenceRef) {
    remove(presenceRef);
    presenceRef = null;
  }
}

export interface ProvinceCount {
  provinceId: string;
  count: number;
}

/**
 * Subscribe to the presence tree.
 * Counts only sessions with ts within the last 30 minutes.
 */
export function subscribeToOnlineCounts(
  callback: (total: number, top5: ProvinceCount[]) => void,
): () => void {
  const rootRef = ref(db, 'presence');
  const unsub = onValue(rootRef, snapshot => {
    const data = snapshot.val() as Record<string, Record<string, { ts: number }>> | null;
    if (!data) { callback(0, []); return; }
    const now = Date.now();
    const counts: ProvinceCount[] = Object.entries(data)
      .map(([provinceId, sessions]) => ({
        provinceId,
        count: Object.values(sessions).filter(s => now - (s.ts ?? 0) < TTL_MS).length,
      }))
      .filter(c => c.count > 0);
    counts.sort((a, b) => b.count - a.count);
    const total = counts.reduce((s, c) => s + c.count, 0);
    callback(total, counts.slice(0, 5));
  });
  return unsub;
}
