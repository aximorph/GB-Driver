import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShiftSession, Entry, ShiftStatus, Intensive } from '@/lib/types';
import { getSessions, saveSessions, getActiveSession, getProfile, getPendingIntensives, savePendingIntensives, clearPendingIntensives } from '@/lib/storage';
import { isGoogleConnected, backupDataToDrive, scheduleMidnightExpiry } from '@/lib/googleDrive';
import { prefetchFuelPrices } from '@/lib/fuelApi';
import { getAuthMode, setAuthMode, isGuestMode } from '@/lib/auth';
import AuthChoiceModal from './AuthChoiceModal';
import { goOnline, goOffline, initPresence, updatePresence, subscribeToOnlineCounts, type ProvinceCount } from '@/lib/presence';
import { getProvinceLabel } from '@/lib/provinces';
import { format } from 'date-fns';
import { localDateStr, getShiftDate, isInsideShiftWindow } from '@/lib/utils';
import { Trash2, Pencil, DollarSign, Receipt, Gift, Clock3, Users, ChevronDown, Timer, Pause, Play } from 'lucide-react';
import AddEntryModal from './AddEntryModal';
import TripTimerDialog from './TripTimerDialog';
import ClaimEntryDialog from './ClaimEntryDialog';
import EndShiftModal from './EndShiftModal';
import MoveTimerModal from './MoveTimerModal';
import SweetAlert from './SweetAlert';
import { useT } from '@/context/LangContext';
import { useIsLandscape } from '@/hooks/useIsLandscape';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// Count income trips eligible for this intensive.
// Bolt orders never count. Order type filter depends on intensive.countsFor.
function countEligibleTrips(entries: Entry[], intensive: Intensive): number {
  const cf = intensive.countsFor ?? 'ride';
  let trips = entries.filter(e => {
    if (e.type !== 'income') return false;
    if (e.note?.startsWith('Intensive:')) return false;
    if (e.platform === 'bolt') return false; // Bolt never counts
    if (e.platform === 'vip')  return false; // VIP (direct) never counts
    if (e.platform === 'etc')  return false; // misc/claim never counts
    if (cf === 'ride') return (e.orderType === 'ride' || !e.orderType);
    if (cf === 'express') return e.orderType === 'express';
    return true; // 'all' — any Grab order
  });

  // Filter by date range (campaign period) if set
  if (intensive.dateStart || intensive.dateEnd) {
    trips = trips.filter(e => {
      const entryDate = (e.tripStartTime ?? e.timestamp).slice(0, 10);
      return entryDate >= (intensive.dateStart ?? '0000-01-01') &&
             entryDate <= (intensive.dateEnd   ?? '9999-12-31');
    });
  }

  // Filter by daily time window if set — use trip START time
  if (!intensive.startTime && !intensive.endTime) return trips.length;
  return trips.filter(e => {
    const d = new Date(e.tripStartTime ?? e.timestamp);
    const hhmm = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return hhmm >= (intensive.startTime ?? '00:00') && hhmm <= (intensive.endTime ?? '23:59');
  }).length;
}

// Return the highest reached tier's bonus (0 if none)
function getEarnedBonus(intensive: Intensive, eligibleTrips: number): number {
  const reached = [...intensive.tiers]
    .sort((a, b) => a.trips - b.trips)
    .filter(t => eligibleTrips >= t.trips);
  return reached[reached.length - 1]?.bonus ?? 0;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const t = useT();
  const isLandscape = useIsLandscape();
  const [sessions, setSessions] = useState<ShiftSession[]>(getSessions());
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(getActiveSession());
  const [elapsed, setElapsed] = useState(0);
  // Restore trip timer dialog if a timer was active before tab switch / reload
  const [showTripTimer, setShowTripTimer] = useState(
    () => !!localStorage.getItem('gbdriver_active_trip'),
  );
  const [tripTimerAutoStart, setTripTimerAutoStart] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addEntryType, setAddEntryType] = useState<'income' | 'expense'>('income');
  const [pendingTripDuration, setPendingTripDuration] = useState<number | undefined>(undefined);
  const [pendingTripStartTime, setPendingTripStartTime] = useState<string | undefined>(undefined);
  const [showEndShift, setShowEndShift] = useState(false);
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  const [showSessionExpiredAlert, setShowSessionExpiredAlert] = useState(false);
  const [showAuthChoice, setShowAuthChoice] = useState(false);
  const [showGuestBackupAlert, setShowGuestBackupAlert] = useState(false);
  const [showClaimEntry, setShowClaimEntry] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [deleteEntryPending, setDeleteEntryPending] = useState<string | null>(null);
  const [editEntryPending, setEditEntryPending] = useState<Entry | null>(null);
  const [collapsedIntensives, setCollapsedIntensives] = useState<Set<string>>(new Set());
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [intensiveToast, setIntensiveToast] = useState<{ count: number; total: number } | null>(null);
  const [tripValueToast, setTripValueToast] = useState<{ netPerMin: number; avgPerMin: number } | null>(null);
  const toggleIntensive = (id: string) => setCollapsedIntensives(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const [onlineTotal, setOnlineTotal] = useState(0);
  const [onlineTop5, setOnlineTop5] = useState<ProvinceCount[]>([]);
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false);
  const onlineDropdownRef = useRef<HTMLDivElement>(null);

  // ── Move Timer ───────────────────────────────────────────────────────────────
  const getMoveTimerDuration = () => (getProfile()?.moveTimerMinutes ?? 15) * 60;
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(getMoveTimerDuration);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playBeep = () => {
    try {
      const actx = new AudioContext();
      // 3 rounds of 3 pulses, gap of 0.5 s between rounds
      for (let round = 0; round < 3; round++) {
        const roundOffset = round * 2.0; // each round spans ~1.5 s, gap of 0.5 s
        for (let i = 0; i < 3; i++) {
          const t = actx.currentTime + roundOffset + i * 0.5;
          const osc  = actx.createOscillator();
          const gain = actx.createGain();
          osc.connect(gain);
          gain.connect(actx.destination);
          osc.frequency.value = 880;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.start(t);
          osc.stop(t + 0.4);
        }
      }
    } catch { /* AudioContext not available */ }
  };

  const startMoveTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const duration = getMoveTimerDuration();
    setTimerSecondsLeft(duration);
    setTimerRunning(true);
    setTimerPaused(false);
    setTimerDone(false);
    setShowTimerModal(true);
    timerIntervalRef.current = setInterval(() => {
      setTimerSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          setTimerDone(true);
          setShowTimerModal(true); // re-open if closed
          playBeep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pauseMoveTimer = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setTimerPaused(true);
  };

  const resumeMoveTimer = () => {
    if (timerPaused && !timerDone) {
      setTimerPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            timerIntervalRef.current = null;
            setTimerDone(true);
            setShowTimerModal(true);
            playBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const resetMoveTimer = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    const duration = getMoveTimerDuration();
    setTimerSecondsLeft(duration);
    setTimerRunning(false);
    setTimerPaused(false);
    setTimerDone(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, []);

  // ── Shift pause ─────────────────────────────────────────────────────────────
  const shiftIsPaused = !!activeSession?.pausedAt;

  const pauseShift = useCallback(() => {
    if (!activeSession || activeSession.pausedAt) return;
    const now = new Date().toISOString();
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeSession.id ? { ...s, pausedAt: now } : s,
      );
      saveSessions(updated);
      return updated;
    });
    setActiveSession(prev => prev ? { ...prev, pausedAt: now } : null);
  }, [activeSession]);

  const resumeShift = useCallback(() => {
    if (!activeSession || !activeSession.pausedAt) return;
    const addedMs = Date.now() - new Date(activeSession.pausedAt).getTime();
    const newTotalPausedMs = (activeSession.totalPausedMs ?? 0) + addedMs;
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeSession.id
          ? { ...s, pausedAt: undefined, totalPausedMs: newTotalPausedMs }
          : s,
      );
      saveSessions(updated);
      return updated;
    });
    setActiveSession(prev =>
      prev ? { ...prev, pausedAt: undefined, totalPausedMs: newTotalPausedMs } : null,
    );
  }, [activeSession]);

  const status: ShiftStatus = activeSession ? 'on_shift' : 'offline';
  const profile = getProfile();
  const today = localDateStr();


  // entries ของ session ที่กำลัง active เท่านั้น — หายเมื่อ end shift
  const activeEntries = activeSession?.entries ?? [];

  // summary ยังคงอิงทั้งวัน (ทุก session ของวันนี้)
  const todayEntries = sessions
    .filter(s => s.date === today)
    .flatMap(s => s.entries);

  const incomeEntries = todayEntries.filter(e => e.type === 'income');
  const grossEarnings = incomeEntries.reduce((sum, e) => sum + (e.driverNet || 0), 0);
  const totalTips = incomeEntries.reduce((sum, e) => sum + (e.tip || 0), 0);
  const totalExpenses = todayEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const netEarnings = grossEarnings + totalTips - totalExpenses;

  // Payment type breakdown (grab + bolt income entries only)
  const payBreakdown = (() => {
    const grabBoltIncome = incomeEntries.filter(e => e.platform === 'grab' || e.platform === 'bolt');
    const cash     = grabBoltIncome.filter(e => e.paymentType === 'cash').reduce((s, e) => s + (e.driverNet || 0), 0);
    const transfer = grabBoltIncome.filter(e => e.paymentType === 'transfer').reduce((s, e) => s + (e.driverNet || 0), 0);
    const credit   = grabBoltIncome.filter(e => e.paymentType === 'credit').reduce((s, e) => s + (e.driverNet || 0), 0);
    const unrecorded = grabBoltIncome.filter(e => !e.paymentType).reduce((s, e) => s + (e.driverNet || 0), 0);
    return { cash, transfer, credit, unrecorded, hasData: grabBoltIncome.length > 0 };
  })();

  // Only show enabled intensives
  const todayIntensives = (profile?.intensives ?? []).filter(i => i.enabled !== false);

  // Keep a ref so the interval always reads the latest session without restarting
  const activeSessionRef = useRef(activeSession);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    const interval = setInterval(() => {
      const s = activeSessionRef.current;
      if (!s) return;
      const now = Date.now();
      const start = new Date(s.startTime).getTime();
      const pausedMs = (s.totalPausedMs ?? 0) +
        (s.pausedAt ? now - new Date(s.pausedAt).getTime() : 0);
      setElapsed(Math.max(0, Math.floor((now - start - pausedMs) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]); // restart only when a new shift begins

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const doStartShift = () => {
    const authMode = getAuthMode();
    // No auth mode chosen yet — show choice modal
    if (authMode === null) { setShowAuthChoice(true); return; }
    // Google mode but token missing — session expired
    if (authMode === 'google' && !isGoogleConnected()) { setShowLoginAlert(true); return; }

    // ── Collect any pending intensive bonuses from PREVIOUS days only ────────
    const pending = getPendingIntensives();
    const readyToAdd = pending.filter(p => p.earnedDate < today);   // only past dates
    const stillPending = pending.filter(p => p.earnedDate >= today); // same-day stays
    savePendingIntensives(stillPending);

    const bonusEntries: Entry[] = readyToAdd.map(p => ({
      id: generateId(),
      sessionId: '', // will be filled in below
      timestamp: new Date().toISOString(),
      type: 'income' as const,
      amount: p.amount,
      driverNet: p.amount,
      note: `Intensive: ${p.name} (${p.earnedDate})`,
    }));

    const sessionId = generateId();
    // Snapshot enabled intensives at shift start — used by endShift so that
    // changes in Settings mid-shift don't affect the bonus calculation.
    const intensivesSnapshot = (getProfile()?.intensives ?? []).filter(i => i.enabled !== false);
    const session: ShiftSession = {
      id: sessionId,
      date: getShiftDate(getProfile()),   // respects shift window (night shift / normal)
      startTime: new Date().toISOString(),
      entries: bonusEntries.map(e => ({ ...e, sessionId })),
      intensivesSnapshot,
    };

    const updated = [...sessions, session];
    setSessions(updated);
    saveSessions(updated);
    setActiveSession(session);
    window.dispatchEvent(new CustomEvent('gbdriver:session-changed'));

    // Presence
    if (profile?.province) goOnline(profile.province);

    // Show toast if bonuses were added
    if (bonusEntries.length > 0) {
      const total = readyToAdd.reduce((s, p) => s + p.amount, 0);
      setIntensiveToast({ count: readyToAdd.length, total });
      setTimeout(() => setIntensiveToast(null), 4000);
    }
  };

  // Public startShift — checks shift window first, warns if outside
  const startShift = () => {
    if (!isInsideShiftWindow(getProfile())) {
      setShowShiftWarning(true);
    } else {
      doStartShift();
    }
  };

  const addEntry = useCallback((entry: Omit<Entry, 'id' | 'sessionId' | 'timestamp'>) => {
    if (!activeSession) return;
    const newEntry: Entry = {
      ...entry,
      id: generateId(),
      sessionId: activeSession.id,
      timestamp: new Date().toISOString(),
    };
    // functional update — always operates on latest state, no stale closure
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeSession.id ? { ...s, entries: [...s.entries, newEntry] } : s
      );
      saveSessions(updated);
      return updated;
    });
    setActiveSession(prev => prev ? { ...prev, entries: [...prev.entries, newEntry] } : null);
    updatePresence();
  }, [activeSession]);

  const endShift = useCallback((grabPayout: number, boltPayout: number = 0) => {
    if (!activeSession) return;

    setSessions(prev => {
      // ── Queue intensive bonuses as PENDING (Grab pays them next day) ───────
      // Use activeSession.date (not closure's `today`) — more robust for cross-midnight shifts.
      const shiftDate = activeSession.date;
      const allShiftDayEntries = prev
        .filter(s => s.date === shiftDate)
        .flatMap(s => s.entries);

      // Use the snapshot taken at shift START — immune to mid-shift Settings changes.
      // Fall back to current profile only for old sessions that predate the snapshot field.
      const intensivesToEvaluate =
        activeSession.intensivesSnapshot ??
        (getProfile()?.intensives ?? []).filter(i => i.enabled !== false);
      const existingPending = getPendingIntensives();

      for (const intensive of intensivesToEvaluate) {
        // Campaign intensives (dateStart/dateEnd) count trips across the whole period,
        // not just today — so the count never resets on a new day.
        const isCampaign = !!(intensive.dateStart || intensive.dateEnd);
        const entriesToCount = isCampaign
          ? prev
              .filter(s =>
                s.date >= (intensive.dateStart ?? '0000-01-01') &&
                s.date <= (intensive.dateEnd   ?? '9999-12-31'),
              )
              .flatMap(s => s.entries)
          : allShiftDayEntries;

        const eligible = countEligibleTrips(entriesToCount, intensive);
        const bonus = getEarnedBonus(intensive, eligible);
        if (bonus <= 0) continue;

        // Campaign intensives: one bonus for the whole campaign (check any date).
        // Daily intensives:    one bonus per shift-date.
        const alreadyPending = isCampaign
          ? existingPending.some(p => p.name === intensive.name)
          : existingPending.some(p => p.name === intensive.name && p.earnedDate === shiftDate);
        const alreadyEntry = isCampaign
          ? prev.some(s => s.entries.some(e =>
              e.note?.startsWith(`Intensive: ${intensive.name} (`),
            ))
          : allShiftDayEntries.some(e =>
              e.note === `Intensive: ${intensive.name} (${shiftDate})`,
            );
        if (alreadyPending || alreadyEntry) continue;

        existingPending.push({ name: intensive.name, amount: bonus, earnedDate: shiftDate });
      }
      savePendingIntensives(existingPending);

      // ── Income adjustments if payout ≠ calculated ────────────────────────────
      const adjustmentEntries = (() => {
        const entries: typeof activeSession.entries = [];

        // Grab adjustment
        if (grabPayout > 0) {
          const grabCalc = activeSession.entries
            .filter(e =>
              e.type === 'income' &&
              !e.note?.startsWith('Intensive:') &&
              e.platform !== 'bolt' &&
              e.platform !== 'vip' &&
              e.platform !== 'etc',
            )
            .reduce((sum, e) => sum + (e.driverNet || 0), 0);
          // Intensive bonuses (prev day) and claim/misc income (platform=etc) are
          // both paid by Grab and included in grabPayout. Subtract them so the
          // adjustment only covers the true per-trip rounding discrepancy —
          // otherwise they'd be counted twice (explicit entries + inside the adj).
          const intensivePaid = activeSession.entries
            .filter(e => e.type === 'income' && e.note?.startsWith('Intensive:'))
            .reduce((sum, e) => sum + (e.driverNet || 0), 0);
          const claimPaid = activeSession.entries
            .filter(e => e.type === 'income' && e.platform === 'etc')
            .reduce((sum, e) => sum + (e.driverNet || 0), 0);
          const grabDiff = Math.round(grabPayout - grabCalc - intensivePaid - claimPaid);
          if (grabDiff !== 0) {
            entries.push({
              id: generateId(),
              sessionId: activeSession.id,
              timestamp: new Date().toISOString(),
              type: 'income' as const,
              platform: 'grab' as const,
              appFare: 0,
              customerPaid: 0,
              tip: 0,
              driverNet: grabDiff,
              amount: grabDiff,
              note: '⚖️ ' + (grabDiff > 0 ? '+' : '') + grabDiff + ' — การปรับรายได้',
            });
          }
        }

        // Bolt adjustment
        if (boltPayout > 0) {
          const boltCalc = activeSession.entries
            .filter(e => e.type === 'income' && e.platform === 'bolt')
            .reduce((sum, e) => sum + (e.driverNet || 0), 0);
          const boltDiff = Math.round(boltPayout - boltCalc);
          if (boltDiff !== 0) {
            entries.push({
              id: generateId(),
              sessionId: activeSession.id,
              timestamp: new Date().toISOString(),
              type: 'income' as const,
              platform: 'bolt' as const,
              appFare: 0,
              customerPaid: 0,
              tip: 0,
              driverNet: boltDiff,
              amount: boltDiff,
              note: '⚖️ ' + (boltDiff > 0 ? '+' : '') + boltDiff + ' — การปรับรายได้',
            });
          }
        }

        return entries;
      })();

      // ── Close out the session ─────────────────────────────────────────────
      // Finalise any in-progress pause (add remaining pause to totalPausedMs)
      const nowMs = Date.now();
      const finalPausedMs = (activeSession.totalPausedMs ?? 0) +
        (activeSession.pausedAt ? nowMs - new Date(activeSession.pausedAt).getTime() : 0);

      const updated = prev.map(s =>
        s.id === activeSession.id
          ? {
              ...s,
              endTime: new Date(nowMs).toISOString(),
              grabPayoutAmount: grabPayout,
              entries: [...s.entries, ...adjustmentEntries],
              pausedAt: undefined,
              totalPausedMs: finalPausedMs > 0 ? finalPausedMs : undefined,
            }
          : s
      );
      saveSessions(updated);
      return updated;
    });

    setActiveSession(null);
    goOffline();
    window.dispatchEvent(new CustomEvent('gbdriver:session-changed'));
    // Clear move timer
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setTimerRunning(false); setTimerPaused(false); setTimerDone(false);

    // ── Auto backup (Google mode only)
    if (!isGuestMode() && isGoogleConnected()) {
      setIsBackingUp(true);
      backupDataToDrive()
        .then(() => {
          const syncTime = new Date().toISOString();
          localStorage.setItem('gdrive_last_sync', syncTime);
        })
        .catch(err => console.warn('Auto backup failed:', err))
        .finally(() => setIsBackingUp(false));
    }
  }, [activeSession]);

  const deleteEntry = useCallback((entryId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => ({
        ...s,
        entries: s.entries.filter(e => e.id !== entryId),
      }));
      saveSessions(updated);
      return updated;
    });
    setActiveSession(prev => prev ? { ...prev, entries: prev.entries.filter(e => e.id !== entryId) } : null);
  }, []);

  const updateEntry = useCallback((entryId: string, updates: Omit<Entry, 'id' | 'sessionId' | 'timestamp'>) => {
    setSessions(prev => {
      const updated = prev.map(s => ({
        ...s,
        entries: s.entries.map(e => e.id === entryId ? { ...e, ...updates } : e),
      }));
      saveSessions(updated);
      return updated;
    });
    setActiveSession(prev => prev
      ? { ...prev, entries: prev.entries.map(e => e.id === entryId ? { ...e, ...updates } : e) }
      : null
    );
    setEditEntryPending(null);
  }, []);


  // Listen for add entry event from BottomNav → open TripTimerDialog
  useEffect(() => {
    const handler = () => setShowTripTimer(true);
    window.addEventListener('gbdriver:open-add-entry', handler);
    return () => window.removeEventListener('gbdriver:open-add-entry', handler);
  }, []);

  // Presence: restore presenceRef after page eviction (key fix)
  useEffect(() => {
    if (activeSession) initPresence();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Presence: subscribe to online counts
  useEffect(() => {
    const unsub = subscribeToOnlineCounts((total, top5) => {
      setOnlineTotal(total);
      setOnlineTop5(top5);
    });
    return unsub;
  }, []);

  // Presence: update when tab becomes visible again after switch
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') updatePresence(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Presence: heartbeat every 5 min while on shift
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(updatePresence, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  // Presence: close dropdown on outside click
  useEffect(() => {
    if (!showOnlineDropdown) return;
    const handler = (e: MouseEvent) => {
      if (onlineDropdownRef.current && !onlineDropdownRef.current.contains(e.target as Node))
        setShowOnlineDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOnlineDropdown]);


  // ตั้ง timer logout ตี 0:00 และ listen event เมื่อ token หมดอายุ
  useEffect(() => {
    scheduleMidnightExpiry();
    const handler = () => setShowLoginAlert(true);
    window.addEventListener('gbdriver:google-disconnected', handler);
    return () => window.removeEventListener('gbdriver:google-disconnected', handler);
  }, []);

  // Pre-warm fuel price cache on mount, then refresh every day at 00:00
  useEffect(() => {
    prefetchFuelPrices();
    // Schedule a refresh each midnight so the cache stays current
    function scheduleMidnightFuelRefresh() {
      const now      = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = midnight.getTime() - now.getTime();
      return setTimeout(() => {
        prefetchFuelPrices();
        // Re-schedule for the next midnight
        timerId = scheduleMidnightFuelRefresh();
      }, msUntilMidnight);
    }
    let timerId = scheduleMidnightFuelRefresh();
    return () => clearTimeout(timerId);
  }, []);

  // ── Reusable sections ────────────────────────────────────────────────
  const lang = profile?.language ?? 'th';

  const shiftStatusSection = (
    <div className="bg-card/80 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-12 -translate-y-12"></div>
      <div className="flex items-center justify-between z-10">
        <span className="text-sm font-medium text-muted-foreground">{t('dash_shift_status')}</span>
        <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full shadow-inner ${status === 'on_shift' ? 'bg-primary border border-primary/50 text-white' : 'bg-secondary text-muted-foreground'}`}>
          {status === 'on_shift' ? t('dash_on_shift') : t('dash_offline')}
        </span>
      </div>
      {status === 'on_shift' && (
        <div className="text-center py-4">
          <p className={`text-4xl font-mono font-extrabold tracking-widest transition-colors ${shiftIsPaused ? 'text-warning/80' : 'text-white'}`}>
            {formatElapsed(elapsed)}
          </p>
          {shiftIsPaused && (
            <p className="text-[11px] text-warning font-bold mt-1 animate-pulse">⏸ หยุดพักชั่วคราว</p>
          )}
        </div>
      )}
      {status === 'offline' ? (
        <button onClick={startShift} className="w-full py-4 mt-2 rounded-xl bg-gradient-to-r from-primary to-[#00b050] shadow-lg shadow-primary/20 text-white font-bold text-sm animate-pulse-glow hover:scale-[1.02] transition-transform">
          {t('dash_start_shift')}
        </button>
      ) : (
        <div className="flex gap-2 mt-2">
          {/* Move Timer button — left of End Shift */}
          <button
            onClick={() => timerRunning ? setShowTimerModal(true) : startMoveTimer()}
            className={`relative flex flex-col items-center justify-center gap-0.5 px-3 rounded-xl text-sm font-bold transition-all shadow-lg min-w-[68px] ${
              timerDone
                ? 'bg-destructive/20 border border-destructive/40 text-destructive animate-pulse'
                : timerRunning
                ? 'bg-primary/15 border border-primary/30 text-primary'
                : 'bg-secondary border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'
            }`}
          >
            <Timer size={20} strokeWidth={2.5} />
            {timerRunning && !timerDone ? (
              <span className="text-[10px] font-mono font-extrabold tabular-nums leading-none">
                {Math.floor(timerSecondsLeft / 60).toString().padStart(2, '0')}:{(timerSecondsLeft % 60).toString().padStart(2, '0')}
              </span>
            ) : (
              <span className="text-[9px] font-bold leading-none">{t('move_timer_btn')}</span>
            )}
            {timerPaused && !timerDone && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warning border border-card" />
            )}
          </button>
          <button onClick={() => {
            if (!isGuestMode() && !isGoogleConnected()) { setShowSessionExpiredAlert(true); return; }
            setShowEndShift(true);
          }} className="flex-1 py-4 rounded-xl bg-destructive text-white font-bold text-sm shadow-lg shadow-destructive/20 hover:scale-[1.02] transition-transform">
            {t('dash_end_shift')}
          </button>
          {/* Shift Pause / Resume button */}
          <button
            onClick={shiftIsPaused ? resumeShift : pauseShift}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 rounded-xl text-sm font-bold transition-all shadow-lg min-w-[68px] ${
              shiftIsPaused
                ? 'bg-warning/20 border border-warning/40 text-warning animate-pulse'
                : 'bg-secondary border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'
            }`}
          >
            {shiftIsPaused
              ? <Play size={20} strokeWidth={2.5} />
              : <Pause size={20} strokeWidth={2.5} />
            }
            <span className="text-[9px] font-bold leading-none">
              {shiftIsPaused ? t('dash_resume') : t('dash_pause')}
            </span>
          </button>
        </div>
      )}
    </div>
  );

  const summarySection = (
    <div className="bg-card/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden" onClick={() => showIncomeBreakdown && setShowIncomeBreakdown(false)}>
      <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-3xl -z-10"></div>
      <div className="flex justify-between items-end mb-6">
        <h3 className="text-xs font-black text-muted-foreground tracking-widest uppercase">{t('dash_summary')}</h3>
        <p className="text-[10px] font-bold text-primary/80 bg-primary/10 px-2 py-1 rounded-md">{todayEntries.length} {t('dash_entries')}</p>
      </div>
      <div className={`grid gap-x-6 gap-y-5 ${isLandscape ? 'grid-cols-4' : 'grid-cols-2'}`}>
        <SummaryItem label={t('dash_net_earnings')} value={netEarnings} color="text-white text-2xl" />
        {/* Gross — clickable when grab/bolt entries exist */}
        <div className="flex flex-col gap-1 relative">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t('dash_gross')}</p>
          <button
            type="button"
            onClick={() => payBreakdown.hasData && setShowIncomeBreakdown(v => !v)}
            className={`font-mono font-extrabold text-primary text-xl text-left ${payBreakdown.hasData ? 'underline decoration-dotted underline-offset-2 cursor-pointer' : ''}`}
          >
            ฿{grossEarnings.toFixed(0)}
          </button>
          {showIncomeBreakdown && payBreakdown.hasData && (
            <div
              className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-xl shadow-2xl p-2 min-w-[148px] space-y-1"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-0.5">{t('dash_income_breakdown')}</p>
              {([
                { key: 'cash',       label: t('dash_pay_cash'),       val: payBreakdown.cash,       color: 'text-primary' },
                { key: 'transfer',   label: t('dash_pay_transfer'),   val: payBreakdown.transfer,   color: 'text-blue-400' },
                { key: 'credit',     label: t('dash_pay_credit'),     val: payBreakdown.credit,     color: 'text-violet-400' },
                { key: 'unrecorded', label: t('dash_pay_unrecorded'), val: payBreakdown.unrecorded, color: 'text-muted-foreground' },
              ] as { key: string; label: string; val: number; color: string }[])
                .filter(r => r.val > 0)
                .map(r => (
                  <div key={r.key} className="flex items-center justify-between gap-2 px-0.5">
                    <span className="text-[11px] text-muted-foreground">{r.label}</span>
                    <span className={`font-mono font-bold text-[11px] ${r.color}`}>฿{r.val.toFixed(0)}</span>
                  </div>
                ))}
              <button
                onClick={() => setShowIncomeBreakdown(false)}
                className="w-full text-[9px] text-muted-foreground hover:text-white transition-colors text-center pt-0.5"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <SummaryItem label={t('dash_tips')} value={totalTips} color="text-warning text-xl" />
        <SummaryItem label={t('dash_expenses')} value={totalExpenses} color="text-destructive text-xl" />
      </div>
      {profile?.dailyGoal && profile.dailyGoal > 0 && (
        <div className="mt-5 pt-4 border-t border-white/5 space-y-2">
          {(() => {
            const pct = Math.min((netEarnings / profile.dailyGoal!) * 100, 100);
            const reached = netEarnings >= profile.dailyGoal!;
            return (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('dash_daily_goal')}</span>
                  <span className={`text-[10px] font-bold font-mono ${reached ? 'text-primary' : 'text-muted-foreground'}`}>
                    ฿{netEarnings.toFixed(0)} / ฿{profile.dailyGoal!.toFixed(0)}{reached && ' ✓'}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${reached ? 'bg-primary shadow-[0_0_8px_rgba(0,242,96,0.5)]' : 'bg-primary/50'}`} style={{ width: `${pct}%` }} />
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );

  const intensivesSection = todayIntensives.length > 0 ? (
    <div className="space-y-3">
      <h3 className="text-xs font-black text-muted-foreground px-2 tracking-widest uppercase">{t('dash_intensive')}</h3>
      {todayIntensives.map(intensive => {
        const sortedTiers = [...intensive.tiers].sort((a, b) => a.trips - b.trips);
        // Campaign intensive: show cumulative progress across the entire date range.
        // Daily intensive: show today's count only.
        const isCampaign = !!(intensive.dateStart || intensive.dateEnd);
        const entriesForProgress = isCampaign
          ? sessions
              .filter(s =>
                s.date >= (intensive.dateStart ?? '0000-01-01') &&
                s.date <= (intensive.dateEnd   ?? '9999-12-31'),
              )
              .flatMap(s => s.entries)
          : todayEntries;
        const eligibleTrips = countEligibleTrips(entriesForProgress, intensive);
        const earnedBonus = getEarnedBonus(intensive, eligibleTrips);
        const currentTier = [...sortedTiers].filter(t => eligibleTrips >= t.trips).pop() ?? null;
        const nextTier = sortedTiers.find(t => eligibleTrips < t.trips) ?? null;
        const progressFrom = currentTier?.trips ?? 0;
        const pct = nextTier ? ((eligibleTrips - progressFrom) / (nextTier.trips - progressFrom)) * 100 : 100;
        const alreadyRecorded = isCampaign
          ? sessions.some(s => s.entries.some(e => e.note?.startsWith(`Intensive: ${intensive.name} (`))) ||
            getPendingIntensives().some(p => p.name === intensive.name)
          : (todayEntries.some(e => e.note?.startsWith(`Intensive: ${intensive.name}`)) ||
             getPendingIntensives().some(p => p.name === intensive.name && p.earnedDate === today));
        const now = new Date();
        const nowHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const todayDate = now.toISOString().slice(0, 10);
        const isInDateRange = !intensive.dateStart ||
          (todayDate >= intensive.dateStart && todayDate <= (intensive.dateEnd ?? '9999-12-31'));
        const isInTimeWindow = !intensive.startTime ||
          (nowHHMM >= intensive.startTime && nowHHMM <= (intensive.endTime ?? '23:59'));
        const isInWindow = isInDateRange && isInTimeWindow;
        const isCollapsed = collapsedIntensives.has(intensive.id);
        return (
          <div key={intensive.id} className={`bg-card/80 backdrop-blur-xl border rounded-2xl shadow-xl ${!isInWindow ? 'border-white/5 opacity-70' : 'border-white/5'}`}>
            {/* ── Header row — always visible, click to toggle ── */}
            <button
              onClick={() => toggleIntensive(intensive.id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <Gift size={16} className={isInWindow ? 'text-primary' : 'text-muted-foreground'} />
                <span className="text-sm font-bold text-white">{intensive.name}</span>
                {!isInWindow && <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md font-mono">{t('dash_outside_window')}</span>}
              </div>
              <div className="flex items-center gap-2">
                {alreadyRecorded ? (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg">{t('dash_recorded')}</span>
                ) : earnedBonus > 0 ? (
                  <span className="text-xs font-mono font-extrabold text-warning bg-warning/10 border border-warning/20 px-2.5 py-1 rounded-lg">+฿{earnedBonus} {t('dash_pending')}</span>
                ) : null}
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} />
              </div>
            </button>
            {/* ── Collapsible body ── */}
            {!isCollapsed && <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            {/* Date range badge */}
            {(intensive.dateStart || intensive.dateEnd) && (
              <div className={`flex items-center gap-1.5 text-[11px] font-mono ${isInDateRange ? 'text-primary' : 'text-muted-foreground'}`}>
                <Clock3 size={11} />
                <span>{intensive.dateStart ?? '—'} – {intensive.dateEnd ?? '—'}</span>
                {!isInDateRange && <span className="text-muted-foreground ml-1 text-[10px]">{t('dash_outside_window')}</span>}
              </div>
            )}
            {/* Daily time window badge */}
            {(intensive.startTime || intensive.endTime) && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <Clock3 size={11} />
                <span>{intensive.startTime ?? '00:00'} – {intensive.endTime ?? '23:59'}</span>
                {isInTimeWindow && isInDateRange && <span className="text-primary font-bold ml-1">{t('dash_active')}</span>}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground">
                  {eligibleTrips} {eligibleTrips !== 1 ? t('dash_eligible_trips') : t('dash_eligible_trip')}
                </span>
                {nextTier ? (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {nextTier.trips - eligibleTrips} {t('dash_more_for')} <span className="text-warning font-bold">+฿{nextTier.bonus}</span>
                  </span>
                ) : earnedBonus > 0 ? <span className="text-[10px] text-primary font-bold">{t('dash_max_tier')}</span> : null}
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${!nextTier && earnedBonus > 0 ? 'bg-primary shadow-[0_0_8px_rgba(0,242,96,0.4)]' : 'bg-primary/60'}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {sortedTiers.map((tier, idx) => {
                const reached = eligibleTrips >= tier.trips;
                return (
                  <div key={idx} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${reached ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-white/5 border-white/5 text-muted-foreground'}`}>
                    <span>{tier.trips}×</span><span>฿{tier.bonus}</span>{reached && <span className="text-[9px]">✓</span>}
                  </div>
                );
              })}
            </div>
            {earnedBonus > 0 && !alreadyRecorded && (
              <p className="text-[10px] text-muted-foreground text-center pt-1 border-t border-white/5">฿{earnedBonus} {t('dash_bonus_pending_note')}</p>
            )}
            </div>}{/* end collapsible body */}
          </div>
        );
      })}
    </div>
  ) : null;

  const recentEntriesSection = activeEntries.length > 0 ? (
    <div className="space-y-4">
      <h3 className="text-xs font-black text-muted-foreground px-2 tracking-widest uppercase mt-6 mb-2">{t('dash_recent_shifts')}</h3>
      {[...activeEntries].reverse().map(entry => (
        <div key={entry.id} className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex flex-col gap-3 shadow-lg hover:bg-card/90 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${entry.type === 'income' ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-destructive/20 text-destructive border border-destructive/20'}`}>
                {entry.type === 'income' ? <DollarSign size={20} strokeWidth={2.5} /> : <Receipt size={20} strokeWidth={2.5} />}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-sm text-foreground">
                    {entry.type === 'income'
                      ? entry.note?.startsWith('Intensive:')
                        ? entry.note
                        : entry.platform === 'vip' || entry.platform === 'etc'
                        ? (entry.note || (entry.platform === 'vip' ? t('dash_vip') : t('dash_etc')))
                        : (entry.orderType === 'express' ? t('dash_express') : t('dash_taxi'))
                      : (entry.expenseCategory || t('dash_expenses'))}
                  </h4>
                  {entry.type === 'income' && !entry.note?.startsWith('Intensive:') && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                      entry.platform === 'bolt' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/20'
                      : entry.platform === 'vip' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/20'
                      : entry.platform === 'etc' ? 'bg-amber-400/15 text-amber-400 border border-amber-400/20'
                      : 'bg-primary/15 text-primary border border-primary/20'
                    }`}>
                      {entry.platform === 'bolt' ? t('dash_bolt')
                       : entry.platform === 'vip' ? t('dash_vip')
                       : entry.platform === 'etc' ? t('dash_etc')
                       : t('dash_grab')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 flex-wrap">
                  <span>{format(new Date(entry.timestamp), 'h:mm a')}</span>
                  {entry.fuelLiters && entry.fuelLiters > 0 && <span className="text-primary font-semibold">· {entry.fuelLiters.toFixed(2)} L</span>}
                  {entry.tripDuration !== undefined && entry.tripDuration > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary/80 bg-primary/10 border border-primary/15 px-1.5 py-0.5 rounded-md font-mono">
                      ⏱ {formatDuration(entry.tripDuration)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-mono text-lg font-extrabold ${entry.type === 'income' ? 'text-white' : 'text-foreground'}`}>
                ฿{entry.type === 'income' ? (entry.driverNet || 0).toFixed(0) : entry.amount.toFixed(0)}
              </p>
              {entry.tip && entry.tip > 0 && <p className="text-[10px] text-warning font-bold uppercase mt-0.5">+ ฿{entry.tip.toFixed(0)} {t('dash_tip_label')}</p>}
              <div className="flex items-center gap-1 mt-2 ml-auto">
                <button onClick={() => setEditEntryPending(entry)} className="text-muted-foreground hover:text-primary transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg flex items-center justify-center">
                  <Pencil size={13} />
                </button>
                <button onClick={() => setDeleteEntryPending(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg flex items-center justify-center">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
          {entry.type === 'income' && entry.appFare && entry.driverNet && (
            <div className="bg-black/20 rounded-xl p-3 flex justify-between items-center border border-white/5 mt-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{t('dash_app_deduction')}</span>
              <span className="text-xs font-mono font-bold text-destructive">
                ฿{Math.max(0, entry.appFare - entry.driverNet).toFixed(0)} ({entry.appFare > 0 ? ((Math.max(0, entry.appFare - entry.driverNet) / entry.appFare) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  ) : null;

  // ── Modals (shared between layouts) ─────────────────────────────────
  const modals = (
    <>
      {/* Shift window warning */}
      <SweetAlert
        show={showShiftWarning}
        icon="warning"
        title={t('profile_shift_outside_title')}
        description={t('profile_shift_outside_desc')}
        confirmText={t('profile_shift_outside_confirm')}
        cancelText={t('profile_shift_outside_cancel')}
        onConfirm={() => { setShowShiftWarning(false); doStartShift(); }}
        onCancel={() => setShowShiftWarning(false)}
      />
      {showTripTimer && (
        <TripTimerDialog
          autoStart={tripTimerAutoStart}
          onEndTrip={(duration, startTime) => {
            setShowTripTimer(false);
            setTripTimerAutoStart(false);
            setPendingTripDuration(duration);
            setPendingTripStartTime(startTime);
            setAddEntryType('income');
            setShowAddEntry(true);
          }}
          onExpense={() => {
            setShowTripTimer(false);
            setTripTimerAutoStart(false);
            setPendingTripDuration(undefined);
            setPendingTripStartTime(undefined);
            setAddEntryType('expense');
            setShowAddEntry(true);
          }}
          onClaim={() => {
            setShowTripTimer(false);
            setTripTimerAutoStart(false);
            setShowClaimEntry(true);
          }}
          onClose={() => { setShowTripTimer(false); setTripTimerAutoStart(false); }}
        />
      )}
      {showAddEntry && (
        <AddEntryModal
          initialType={addEntryType}
          initialTripDuration={pendingTripDuration}
          initialTripStartTime={pendingTripStartTime}
          onSave={(entry) => {
            addEntry(entry);
            setShowAddEntry(false);
            setPendingTripDuration(undefined);
            setPendingTripStartTime(undefined);

            // Task 2: Reset move timer when an income trip is added
            if (entry.type === 'income' && timerRunning) {
              resetMoveTimer();
            }

            // Task 3: Trip value toast (only for real trips with duration, >7 days of history)
            if (
              entry.type === 'income' &&
              !entry.note?.startsWith('Intensive:') &&
              (entry.tripDuration ?? 0) > 0 &&
              (entry.driverNet ?? 0) > 0
            ) {
              const allSessions = getSessions();
              const distinctDates = new Set(allSessions.map(s => s.date));
              if (distinctDates.size > 7) {
                const allEntries = allSessions.flatMap(s => s.entries);
                const tripsWithDuration = allEntries.filter(e =>
                  e.type === 'income' &&
                  !e.note?.startsWith('Intensive:') &&
                  (e.tripDuration ?? 0) > 0 &&
                  (e.driverNet ?? 0) > 0,
                );
                if (tripsWithDuration.length > 0) {
                  const avgPerMin = tripsWithDuration.reduce(
                    (sum, e) => sum + (e.driverNet ?? 0) / ((e.tripDuration ?? 1) / 60), 0,
                  ) / tripsWithDuration.length;
                  const netPerMin = (entry.driverNet ?? 0) / ((entry.tripDuration ?? 1) / 60);
                  setTripValueToast({ netPerMin, avgPerMin });
                  setTimeout(() => setTripValueToast(null), 5000);
                }
              }
            }
          }}
          onClose={() => {
            setShowAddEntry(false);
            setPendingTripDuration(undefined);
            setPendingTripStartTime(undefined);
          }}
        />
      )}
      {showClaimEntry && (
        <ClaimEntryDialog
          onSave={(entry) => { addEntry(entry); setShowClaimEntry(false); }}
          onClose={() => setShowClaimEntry(false)}
        />
      )}
      {editEntryPending && (
        <AddEntryModal
          editEntry={editEntryPending}
          onSave={() => {}}
          onUpdate={updateEntry}
          onClose={() => setEditEntryPending(null)}
        />
      )}
      {showEndShift && activeSession && (
        <EndShiftModal
          session={activeSession}
          onConfirm={(grabPayout, boltPayout) => { endShift(grabPayout, boltPayout); setShowEndShift(false); }}
          onClose={() => setShowEndShift(false)}
        />
      )}
      <SweetAlert
        show={showLoginAlert}
        icon="warning"
        title={t('dash_login_required_title')}
        description={t('dash_login_required_desc')}
        confirmText={t('dash_go_to_profile')}
        cancelText={t('dash_cancel')}
        onConfirm={() => { setShowLoginAlert(false); navigate('/profile'); }}
        onCancel={() => setShowLoginAlert(false)}
      />
      {showAuthChoice && (
        <AuthChoiceModal
          onSelectGoogle={() => { setShowAuthChoice(false); navigate('/profile'); }}
          onSelectGuest={() => {
            setAuthMode('guest');
            setShowAuthChoice(false);
          }}
          onClose={() => setShowAuthChoice(false)}
        />
      )}
      <SweetAlert
        show={showGuestBackupAlert}
        icon="warning"
        title={t('auth_guest_backup_title')}
        description={t('auth_guest_backup_desc')}
        confirmText={t('auth_switch_to_google')}
        cancelText={t('dash_cancel')}
        onConfirm={() => { setShowGuestBackupAlert(false); navigate('/profile'); }}
        onCancel={() => setShowGuestBackupAlert(false)}
      />
      <SweetAlert
        show={showSessionExpiredAlert}
        icon="warning"
        title={t('dash_session_expired_title')}
        description={t('dash_session_expired_desc')}
        confirmText={t('dash_session_go_settings')}
        cancelText={t('dash_session_end_anyway')}
        onConfirm={() => { setShowSessionExpiredAlert(false); navigate('/profile'); }}
        onCancel={() => { setShowSessionExpiredAlert(false); setShowEndShift(true); }}
      />
      <SweetAlert
        show={!!deleteEntryPending}
        icon="warning"
        title={t('alert_delete_entry_title')}
        description={t('alert_delete_entry_desc')}
        confirmText={t('alert_delete_entry_confirm')}
        cancelText={t('alert_cancel')}
        onConfirm={() => { if (deleteEntryPending) { deleteEntry(deleteEntryPending); setDeleteEntryPending(null); } }}
        onCancel={() => setDeleteEntryPending(null)}
      />
      {showTimerModal && (
        <MoveTimerModal
          secondsLeft={timerSecondsLeft}
          totalSeconds={getMoveTimerDuration()}
          isPaused={timerPaused}
          isDone={timerDone}
          onPause={pauseMoveTimer}
          onResume={resumeMoveTimer}
          onReset={() => { resetMoveTimer(); setShowTimerModal(false); }}
          onClose={() => setShowTimerModal(false)}
          onAcceptJob={() => {
            resetMoveTimer();        // stop & reset move timer
            setShowTimerModal(false);
            setTripTimerAutoStart(true); // auto-start trip timer
            setShowTripTimer(true);
          }}
        />
      )}
      {isBackingUp && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 shadow-xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span className="text-xs font-bold text-muted-foreground">{t('dash_backing_up')}</span>
        </div>
      )}
      {intensiveToast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-max max-w-[320px] bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Gift size={18} className="text-primary shrink-0" />
          <div>
            <p className="text-xs font-extrabold text-white">{t('dash_intensive_added_toast')}</p>
            <p className="text-[11px] text-primary font-mono font-bold mt-0.5">
              {intensiveToast.count} {intensiveToast.count > 1 ? 'รายการ' : 'รายการ'} · +฿{intensiveToast.total.toFixed(0)}
            </p>
          </div>
        </div>
      )}
      {tripValueToast && (() => {
        const isGood = tripValueToast.netPerMin >= tripValueToast.avgPerMin;
        return (
          <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 w-max max-w-[320px] bg-card/95 backdrop-blur-xl border rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isGood ? 'border-primary/30' : 'border-white/10'}`}>
            <span className="text-xl shrink-0">{isGood ? '🔥' : '📉'}</span>
            <div>
              <p className={`text-xs font-extrabold ${isGood ? 'text-primary' : 'text-muted-foreground'}`}>
                {isGood ? t('toast_trip_good') : t('toast_trip_low')}
              </p>
              <p className="text-[11px] text-white font-mono mt-0.5">
                ฿{tripValueToast.netPerMin.toFixed(1)} {t('toast_per_min')}
                <span className="text-muted-foreground"> · {t('toast_avg')} ฿{tripValueToast.avgPerMin.toFixed(1)}</span>
              </p>
            </div>
          </div>
        );
      })()}
    </>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[#00f260] to-primary bg-clip-text text-transparent drop-shadow-sm">GB-Driver</h1>
          {isGuestMode() && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-warning/15 border border-warning/30 text-warning tracking-widest">
              {t('auth_guest_badge')}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMM d, yyyy')}</p>
      </div>
      {/* Online drivers badge */}
      <div className="relative" ref={onlineDropdownRef}>
        <button
          onClick={() => setShowOnlineDropdown(v => !v)}
          className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
        >
          <Users size={11} />
          {onlineTotal}
          <span className="text-primary/70 font-normal">{t('dash_online_total')}</span>
          <ChevronDown size={10} className={`transition-transform duration-200 ${showOnlineDropdown ? 'rotate-180' : ''}`} />
        </button>
        {showOnlineDropdown && (
          <div className="absolute right-0 top-full mt-1.5 w-52 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-1 duration-150">
            <div className="px-3 pt-3 pb-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('dash_online_top5')}</p>
            </div>
            {onlineTop5.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 pb-3 pt-1">{t('dash_online_no_data')}</p>
            ) : (
              <ul className="pb-2">
                {onlineTop5.map((item, i) => (
                  <li key={item.provinceId} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-2 text-xs text-foreground">
                      <span className="text-muted-foreground font-mono w-4">{i + 1}.</span>
                      {getProvinceLabel(item.provinceId, lang)}
                    </span>
                    <span className="text-xs font-mono font-bold text-primary">{item.count}</span>
                  </li>
                ))}
              </ul>
            )}
            {!profile?.province && (
              <p className="text-[10px] text-muted-foreground/70 px-3 pb-2.5 border-t border-white/5 pt-2">{t('dash_online_set_province')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 ${isLandscape ? 'p-4 pb-4' : 'pb-24 p-4'}`}>
      {isLandscape ? (
        /* ── Landscape: two-column ─────────────────────────────────────── */
        <div className="space-y-4">
          {header}
          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              {shiftStatusSection}
              {summarySection}
            </div>
            <div className="space-y-4">
              {intensivesSection}
              {recentEntriesSection}
            </div>
          </div>
        </div>
      ) : (
        /* ── Portrait: single column ───────────────────────────────────── */
        <div className="space-y-4">
          {header}
          {shiftStatusSection}
          {summarySection}
          {intensivesSection}
          {recentEntriesSection}
        </div>
      )}
      {modals}
    </div>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`font-mono font-extrabold ${color}`}>฿{value.toFixed(0)}</p>
    </div>
  );
}
