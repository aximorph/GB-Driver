import { db } from './firebase';
import { ref, set, remove, onValue, type DatabaseReference } from 'firebase/database';

// Unique ID for this browser tab / session
const SESSION_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// A presence node is considered "online" if its timestamp is newer than this
const TTL_MS = 30 * 60 * 1000; // 30 minutes

let presenceRef: DatabaseReference | null = null;

/**
 * Call when driver starts a shift.
 * Writes { ts } to Firebase — no WebSocket dependency.
 */
export function goOnline(provinceId: string): void {
  presenceRef = ref(db, `presence/${provinceId}/${SESSION_ID}`);
  set(presenceRef, { ts: Date.now() });
}

/**
 * Call whenever the user does something active (nav tap, add entry, tab focus).
 * No-op if not currently on shift.
 */
export function updatePresence(): void {
  if (!presenceRef) return;
  set(presenceRef, { ts: Date.now() });
}

/** Call when driver ends a shift — removes this session's node immediately. */
export function goOffline(): void {
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
 * Only counts sessions whose `ts` is within the last 30 minutes.
 * Returns an unsubscribe function.
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
