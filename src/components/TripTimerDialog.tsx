import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Receipt, Coins } from 'lucide-react';
import { useT } from '@/context/LangContext';

// ── Persist active trip timer across tab switches / page reloads ──────────────
const TIMER_KEY = 'gbdriver_active_trip';
const PLATFORM_KEY = 'gbdriver_active_trip_platform';

function saveTimer(startISO: string) {
  localStorage.setItem(TIMER_KEY, startISO);
}
function loadTimer(): string | null {
  return localStorage.getItem(TIMER_KEY);
}
function clearTimer() {
  localStorage.removeItem(TIMER_KEY);
}

type Platform = 'grab' | 'bolt' | 'vip';

function savePlatform(p: Platform) {
  localStorage.setItem(PLATFORM_KEY, p);
}
function loadPlatform(): Platform {
  const p = localStorage.getItem(PLATFORM_KEY);
  return p === 'bolt' || p === 'vip' ? p : 'grab';
}
function clearPlatform() {
  localStorage.removeItem(PLATFORM_KEY);
}

interface Props {
  onEndTrip: (tripDuration: number, tripStartTime: string, platform: Platform) => void;
  onExpense: () => void;
  onClaim: () => void;
  onClose: () => void;
  autoStart?: boolean; // start immediately on mount (from "รับงาน" button)
}

function formatStopwatch(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function TripTimerDialog({ onEndTrip, onExpense, onClaim, onClose, autoStart }: Props) {
  const t = useT();

  // ── Initialise from localStorage (survives tab switch / reload) ──────────
  const [tripStartISO, setTripStartISO] = useState<string>(() => {
    // autoStart takes priority; otherwise restore saved timer
    if (autoStart) {
      const iso = new Date().toISOString();
      saveTimer(iso);
      return iso;
    }
    return loadTimer() ?? '';
  });

  const running = tripStartISO !== '';
  const [elapsed, setElapsed] = useState(() =>
    tripStartISO ? Math.floor((Date.now() - new Date(tripStartISO).getTime()) / 1000) : 0,
  );

  // Platform (Grab / Bolt / VIP) — chosen while the trip is running, persisted
  // across reload/tab-switch the same way the start time is.
  const [platform, setPlatform] = useState<Platform>(() => {
    if (autoStart) {
      savePlatform('grab');
      return 'grab';
    }
    return loadPlatform();
  });

  // Tick every second while running
  useEffect(() => {
    if (!running) return;
    const start = new Date(tripStartISO).getTime();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running, tripStartISO]);

  const handleStart = () => {
    const iso = new Date().toISOString();
    saveTimer(iso);
    setTripStartISO(iso);
    setElapsed(0);
  };

  const handleSelectPlatform = (p: Platform) => {
    setPlatform(p);
    savePlatform(p);
  };

  const handleEnd = () => {
    const duration = Math.floor((Date.now() - new Date(tripStartISO).getTime()) / 1000);
    clearTimer();
    clearPlatform();
    onEndTrip(duration, tripStartISO, platform);
  };

  const handleCancelTrip = () => {
    clearTimer();
    clearPlatform();
    setTripStartISO('');
    setElapsed(0);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
      // backdrop tap never closes when timer is running
      onClick={!running ? onClose : undefined}
    >
      <div
        className="w-full max-w-[430px] bg-card/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[2rem] p-6 space-y-5 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-extrabold text-white">{t('timer_new_trip')}</h2>
          {/* X button only visible before timer starts */}
          {!running && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-white transition-colors bg-white/5 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
          )}
        </div>

        {/* Stopwatch */}
        <div className={`rounded-3xl p-8 text-center transition-all ${
          running
            ? 'bg-primary/10 border border-primary/20'
            : 'bg-secondary/50 border border-white/5'
        }`}>
          <p className={`text-5xl font-mono font-extrabold tracking-widest transition-colors ${
            running ? 'text-primary' : 'text-muted-foreground'
          }`}>
            {formatStopwatch(elapsed)}
          </p>
          {running && (
            <p className="text-xs font-bold text-primary/70 mt-2 uppercase tracking-widest animate-pulse">
              {t('timer_in_progress')}…
            </p>
          )}
        </div>

        {/* Platform selector — Grab · Bolt · VIP — chosen while delivering to the customer */}
        {running && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1.5">
              {t('timer_platform_label')}
            </p>
            <div className="flex bg-secondary/60 p-1 rounded-xl border border-white/5 gap-1">
              {([
                { value: 'grab' as const, label: t('add_grab'), cls: 'text-primary border-primary/30 bg-primary/20' },
                { value: 'bolt' as const, label: t('add_bolt'), cls: 'text-violet-400 border-violet-400/30 bg-violet-400/15' },
                { value: 'vip'  as const, label: t('add_vip'),  cls: 'text-pink-400 border-pink-400/30 bg-pink-400/15' },
              ]).map(p => (
                <button key={p.value} onClick={() => handleSelectPlatform(p.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    platform === p.value ? `${p.cls} border` : 'text-muted-foreground hover:text-white'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        {!running ? (
          <div className="space-y-3">
            <button
              onClick={handleStart}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-[#00b050] text-white font-extrabold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
            >
              {t('timer_start')}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onExpense}
                className="py-3.5 rounded-2xl bg-secondary border border-white/5 text-muted-foreground hover:text-white hover:border-white/10 font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Receipt size={15} />
                {t('timer_add_expense')}
              </button>
              <button
                onClick={onClaim}
                className="py-3.5 rounded-2xl bg-secondary border border-white/5 text-muted-foreground hover:text-amber-400 hover:border-amber-400/30 font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Coins size={15} />
                {t('timer_add_claim')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Cancel trip — only exit while timer is running */}
            <button
              onClick={handleCancelTrip}
              className="py-4 rounded-2xl bg-secondary border border-white/5 text-muted-foreground hover:text-destructive hover:border-destructive/30 font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <XCircle size={18} />
              {t('timer_cancel_trip')}
            </button>

            {/* End trip */}
            <button
              onClick={handleEnd}
              className="py-4 rounded-2xl bg-gradient-to-r from-primary to-[#00b050] text-white font-extrabold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              {t('timer_end')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
