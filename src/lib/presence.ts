/**
 * Presence via Cloudflare Pages Functions + KV
 *
 * Flow:
 *  goOnline()      → POST /api/presence/ping  (then heartbeat every HEARTBEAT_MS)
 *  updatePresence()→ POST /api/presence/ping  (called on user activity)
 *  goOffline()     → POST /api/presence/offline + stop heartbeat
 *
 * subscribeToOnlineCounts() polls GET /api/presence/counts every POLL_MS
 * and calls the callback with fresh data.
 */

const HEARTBEAT_MS = 5 * 60 * 1000;  // ping every 5 minutes while on shift
const POLL_MS      = 30 * 1000;       // refresh online count every 30 seconds

// ── Stable session ID (survives page reload, cleared when explicitly offline) ──
const SESSION_ID = (() => {
  const KEY = 'gbdriver_session_id';
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  localStorage.setItem(KEY, id);
  return id;
})();

const PROVINCE_KEY = 'gbdriver_presence_province';

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentProvince: string | null = null;

// ── helpers ──────────────────────────────────────────────────────────────────

async function postPing(provinceId: string): Promise<void> {
  try {
    await fetch('/api/presence/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provinceId, sessionId: SESSION_ID }),
    });
  } catch {
    // silently ignore network errors — non-critical feature
  }
}

async function postOffline(provinceId: string): Promise<void> {
  try {
    await fetch('/api/presence/offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provinceId, sessionId: SESSION_ID }),
    });
  } catch {
    // silently ignore
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call when driver starts a shift. */
export function goOnline(provinceId: string): void {
  currentProvince = provinceId;
  localStorage.setItem(PROVINCE_KEY, provinceId);
  void postPing(provinceId);

  // Start heartbeat to keep KV key alive
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (currentProvince) void postPing(currentProvince);
  }, HEARTBEAT_MS);
}

/**
 * Call on Dashboard mount.
 * Reconstructs presence if the page was evicted mid-shift.
 */
export function initPresence(): void {
  if (currentProvince) return; // already running
  const province = localStorage.getItem(PROVINCE_KEY);
  if (!province) return; // not on shift
  goOnline(province); // re-registers heartbeat + ping
}

/** Call on user activity while on shift (keeps presence fresh). */
export function updatePresence(): void {
  if (!currentProvince) return;
  void postPing(currentProvince);
}

/** Call when driver ends a shift. */
export function goOffline(): void {
  const province = currentProvince ?? localStorage.getItem(PROVINCE_KEY);
  localStorage.removeItem(PROVINCE_KEY);
  currentProvince = null;
  stopHeartbeat();
  if (province) void postOffline(province);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ── Subscribe ─────────────────────────────────────────────────────────────────

export interface ProvinceCount {
  provinceId: string;
  count: number;
}

/**
 * Polls /api/presence/counts and calls callback with updated data.
 * Returns an unsubscribe function.
 */
export function subscribeToOnlineCounts(
  callback: (total: number, top5: ProvinceCount[]) => void,
): () => void {
  let cancelled = false;

  const fetchCounts = async () => {
    try {
      const res = await fetch('/api/presence/counts');
      if (!res.ok) return;
      const data = await res.json() as { total: number; top5: ProvinceCount[] };
      if (!cancelled) callback(data.total, data.top5);
    } catch {
      // silently ignore
    }
  };

  // Fetch immediately, then on interval
  void fetchCounts();
  const timer = setInterval(() => { if (!cancelled) void fetchCounts(); }, POLL_MS);

  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}
