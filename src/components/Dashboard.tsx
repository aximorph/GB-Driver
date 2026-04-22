import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShiftSession, Entry, ShiftStatus, Intensive } from '@/lib/types';
import { getSessions, saveSessions, getActiveSession, getProfile } from '@/lib/storage';
import { isGoogleConnected, backupDataToDrive, scheduleMidnightExpiry } from '@/lib/googleDrive';
import { format } from 'date-fns';
import { Trash2, DollarSign, Receipt, Gift, Clock3 } from 'lucide-react';
import AddEntryModal from './AddEntryModal';
import TripTimerDialog from './TripTimerDialog';
import EndShiftModal from './EndShiftModal';
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
  const trips = entries.filter(e => {
    if (e.type !== 'income') return false;
    if (e.note?.startsWith('Intensive:')) return false;
    if (e.platform === 'bolt') return false; // Bolt never counts
    if (cf === 'ride') return (e.orderType === 'ride' || !e.orderType);
    if (cf === 'express') return e.orderType === 'express';
    return true; // 'all' — any Grab order
  });
  if (!intensive.startTime && !intensive.endTime) return trips.length;
  return trips.filter(e => {
    // Use trip START time (when job appeared) if available; fall back to entry timestamp
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
  const [showTripTimer, setShowTripTimer] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addEntryType, setAddEntryType] = useState<'income' | 'expense'>('income');
  const [pendingTripDuration, setPendingTripDuration] = useState<number | undefined>(undefined);
  const [pendingTripStartTime, setPendingTripStartTime] = useState<string | undefined>(undefined);
  const [showEndShift, setShowEndShift] = useState(false);
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const status: ShiftStatus = activeSession ? 'on_shift' : 'offline';
  const profile = getProfile();
  const today = new Date().toISOString().split('T')[0];


  // entries ของ session ที่กำลัง active เท่านั้น — หายเมื่อ end shift
  const activeEntries = activeSession?.entries ?? [];

  // summary ยังคงอิงทั้งวัน (ทุก session ของวันนี้)
  const todayEntries = sessions
    .filter(s => s.date === today)
    .flatMap(s => s.entries);

  const grossEarnings = todayEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + (e.driverNet || 0), 0);
  const totalTips = todayEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + (e.tip || 0), 0);
  const totalExpenses = todayEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const netEarnings = grossEarnings + totalTips - totalExpenses;

  // Only show enabled intensives
  const todayIntensives = (profile?.intensives ?? []).filter(i => i.enabled !== false);

  useEffect(() => {
    if (!activeSession) return;
    const start = new Date(activeSession.startTime).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const startShift = () => {
    // ต้อง login Google ก่อน
    if (!isGoogleConnected()) {
      setShowLoginAlert(true);
      return;
    }
    const session: ShiftSession = {
      id: generateId(),
      date: today,
      startTime: new Date().toISOString(),
      entries: [],
    };
    const updated = [...sessions, session];
    setSessions(updated);
    saveSessions(updated);
    setActiveSession(session);
    window.dispatchEvent(new CustomEvent('gbdriver:session-changed'));
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
  }, [activeSession]);

  const endShift = useCallback((grabPayout: number) => {
    if (!activeSession) return;

    setSessions(prev => {
      // ── Build intensive bonus entries ──────────────────────────────────────
      // NOTE: prev already contains the active session with all its entries.
      // Do NOT concat activeSession.entries — that would double-count them.
      const allTodayEntries = prev
        .filter(s => s.date === today)
        .flatMap(s => s.entries);

      const bonusEntries: Entry[] = [];
      const todayIntensivesNow = (getProfile()?.intensives ?? []).filter(i => i.enabled !== false);

      for (const intensive of todayIntensivesNow) {
        const eligible = countEligibleTrips(allTodayEntries, intensive);
        const bonus = getEarnedBonus(intensive, eligible);
        if (bonus <= 0) continue;

        // Skip if bonus already recorded in a previous session today
        const alreadyRecorded = allTodayEntries.some(
          e => e.note === `Intensive: ${intensive.name}`
        );
        if (alreadyRecorded) continue;

        bonusEntries.push({
          id: generateId(),
          sessionId: activeSession.id,
          timestamp: new Date().toISOString(),
          type: 'income',
          amount: bonus,
          driverNet: bonus,
          note: `Intensive: ${intensive.name}`,
        });
      }

      const updated = prev.map(s =>
        s.id === activeSession.id
          ? { ...s, endTime: new Date().toISOString(), grabPayoutAmount: grabPayout, entries: [...s.entries, ...bonusEntries] }
          : s
      );
      saveSessions(updated);
      return updated;
    });

    setActiveSession(null);
    window.dispatchEvent(new CustomEvent('gbdriver:session-changed'));

    // ── Auto backup OUTSIDE setSessions (side-effects must not live in updaters)
    if (isGoogleConnected()) {
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

  // Listen for add entry event from BottomNav → open TripTimerDialog
  useEffect(() => {
    const handler = () => setShowTripTimer(true);
    window.addEventListener('gbdriver:open-add-entry', handler);
    return () => window.removeEventListener('gbdriver:open-add-entry', handler);
  }, []);

  // ตั้ง timer logout ตี 0:00 และ listen event เมื่อ token หมดอายุ
  useEffect(() => {
    scheduleMidnightExpiry();
    const handler = () => setShowLoginAlert(true);
    window.addEventListener('gbdriver:google-disconnected', handler);
    return () => window.removeEventListener('gbdriver:google-disconnected', handler);
  }, []);

  // ── Reusable sections ────────────────────────────────────────────────
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
          <p className="text-4xl font-mono font-extrabold text-white tracking-widest">{formatElapsed(elapsed)}</p>
        </div>
      )}
      {status === 'offline' ? (
        <button onClick={startShift} className="w-full py-4 mt-2 rounded-xl bg-gradient-to-r from-primary to-[#00b050] shadow-lg shadow-primary/20 text-white font-bold text-sm animate-pulse-glow hover:scale-[1.02] transition-transform">
          {t('dash_start_shift')}
        </button>
      ) : (
        <button onClick={() => setShowEndShift(true)} className="w-full py-4 mt-2 rounded-xl bg-destructive text-white font-bold text-sm shadow-lg shadow-destructive/20 hover:scale-[1.02] transition-transform">
          {t('dash_end_shift')}
        </button>
      )}
    </div>
  );

  const summarySection = (
    <div className="bg-card/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-3xl -z-10"></div>
      <div className="flex justify-between items-end mb-6">
        <h3 className="text-xs font-black text-muted-foreground tracking-widest uppercase">{t('dash_summary')}</h3>
        <p className="text-[10px] font-bold text-primary/80 bg-primary/10 px-2 py-1 rounded-md">{todayEntries.length} {t('dash_entries')}</p>
      </div>
      <div className={`grid gap-x-6 gap-y-5 ${isLandscape ? 'grid-cols-4' : 'grid-cols-2'}`}>
        <SummaryItem label={t('dash_net_earnings')} value={netEarnings} color="text-white text-2xl" />
        <SummaryItem label={t('dash_gross')} value={grossEarnings} color="text-primary text-xl" />
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
        const eligibleTrips = countEligibleTrips(todayEntries, intensive);
        const earnedBonus = getEarnedBonus(intensive, eligibleTrips);
        const currentTier = [...sortedTiers].filter(t => eligibleTrips >= t.trips).pop() ?? null;
        const nextTier = sortedTiers.find(t => eligibleTrips < t.trips) ?? null;
        const progressFrom = currentTier?.trips ?? 0;
        const pct = nextTier ? ((eligibleTrips - progressFrom) / (nextTier.trips - progressFrom)) * 100 : 100;
        const alreadyRecorded = todayEntries.some(e => e.note === `Intensive: ${intensive.name}`);
        const now = new Date();
        const nowHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const isInWindow = !intensive.startTime || (nowHHMM >= intensive.startTime && nowHHMM <= (intensive.endTime ?? '23:59'));
        return (
          <div key={intensive.id} className={`bg-card/80 backdrop-blur-xl border rounded-2xl p-5 shadow-xl space-y-3 ${!isInWindow ? 'border-white/5 opacity-70' : 'border-white/5'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift size={16} className={isInWindow ? 'text-primary' : 'text-muted-foreground'} />
                <span className="text-sm font-bold text-white">{intensive.name}</span>
                {!isInWindow && <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md font-mono">{t('dash_outside_window')}</span>}
              </div>
              {alreadyRecorded ? (
                <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg">{t('dash_recorded')}</span>
              ) : earnedBonus > 0 ? (
                <span className="text-xs font-mono font-extrabold text-warning bg-warning/10 border border-warning/20 px-2.5 py-1 rounded-lg">+฿{earnedBonus} {t('dash_pending')}</span>
              ) : null}
            </div>
            {(intensive.startTime || intensive.endTime) && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <Clock3 size={11} />
                <span>{intensive.startTime ?? '00:00'} – {intensive.endTime ?? '23:59'}</span>
                {isInWindow && <span className="text-primary font-bold ml-1">{t('dash_active')}</span>}
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
                      ? entry.note?.startsWith('Intensive:') ? entry.note : (entry.orderType === 'express' ? t('dash_express') : t('dash_taxi'))
                      : (entry.expenseCategory || t('dash_expenses'))}
                  </h4>
                  {entry.type === 'income' && !entry.note?.startsWith('Intensive:') && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${entry.platform === 'bolt' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20' : 'bg-primary/15 text-primary border border-primary/20'}`}>
                      {entry.platform === 'bolt' ? t('dash_bolt') : t('dash_grab')}
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
                ฿{entry.type === 'income' ? ((entry.driverNet || 0) + (entry.tip || 0)).toFixed(0) : entry.amount.toFixed(0)}
              </p>
              {entry.tip && entry.tip > 0 && <p className="text-[10px] text-warning font-bold uppercase mt-0.5">+ ฿{entry.tip.toFixed(0)} {t('dash_tip_label')}</p>}
              <button onClick={() => deleteEntry(entry.id)} className="mt-2 text-muted-foreground hover:text-destructive transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg flex items-center justify-center ml-auto">
                <Trash2 size={14} />
              </button>
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
      {showTripTimer && (
        <TripTimerDialog
          onEndTrip={(duration, startTime) => {
            setShowTripTimer(false);
            setPendingTripDuration(duration);
            setPendingTripStartTime(startTime);
            setAddEntryType('income');
            setShowAddEntry(true);
          }}
          onExpense={() => {
            setShowTripTimer(false);
            setPendingTripDuration(undefined);
            setPendingTripStartTime(undefined);
            setAddEntryType('expense');
            setShowAddEntry(true);
          }}
          onClose={() => setShowTripTimer(false)}
        />
      )}
      {showAddEntry && (
        <AddEntryModal
          initialType={addEntryType}
          lockType={true}
          initialTripDuration={pendingTripDuration}
          initialTripStartTime={pendingTripStartTime}
          onSave={(entry) => {
            addEntry(entry);
            setShowAddEntry(false);
            setPendingTripDuration(undefined);
            setPendingTripStartTime(undefined);
          }}
          onClose={() => {
            setShowAddEntry(false);
            setPendingTripDuration(undefined);
            setPendingTripStartTime(undefined);
          }}
        />
      )}
      {showEndShift && activeSession && (
        <EndShiftModal
          session={activeSession}
          onConfirm={(payout) => { endShift(payout); setShowEndShift(false); }}
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
      {isBackingUp && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 shadow-xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span className="text-xs font-bold text-muted-foreground">{t('dash_backing_up')}</span>
        </div>
      )}
    </>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[#00f260] to-primary bg-clip-text text-transparent drop-shadow-sm">GB-Driver</h1>
        <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMM d, yyyy')}</p>
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
