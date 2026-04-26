import { db } from './firebase';
import { ref, set, remove, onDisconnect, onValue, type DatabaseReference } from 'firebase/database';

// Unique ID for this browser tab session
const SESSION_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let presenceRef: DatabaseReference | null = null;

/** Call when driver starts a shift. Province is the province.id slug. */
export function goOnline(provinceId: string): void {
  presenceRef = ref(db, `presence/${provinceId}/${SESSION_ID}`);
  set(presenceRef, { ts: Date.now() });
  // Firebase server will auto-remove this node if the client disconnects
  onDisconnect(presenceRef).remove();
}

/** Call when driver ends a shift (manual clean-up). */
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
 * Subscribe to the presence tree and receive top-5 provinces sorted by count.
 * Returns an unsubscribe function.
 */
export function subscribeToOnlineCounts(
  callback: (total: number, top5: ProvinceCount[]) => void
): () => void {
  const rootRef = ref(db, 'presence');
  const unsub = onValue(rootRef, snapshot => {
    const data = snapshot.val() as Record<string, Record<string, unknown>> | null;
    if (!data) {
      callback(0, []);
      return;
    }
    const counts: ProvinceCount[] = Object.entries(data).map(([provinceId, sessions]) => ({
      provinceId,
      count: Object.keys(sessions).length,
    }));
    counts.sort((a, b) => b.count - a.count);
    const total = counts.reduce((s, c) => s + c.count, 0);
    callback(total, counts.slice(0, 5));
  });
  return unsub;
}
