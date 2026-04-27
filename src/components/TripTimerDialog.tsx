import { useState, useEffect } from 'react';
import { Play, CheckCircle2, XCircle, Receipt } from 'lucide-react';
import { useT } from '@/context/LangContext';

interface Props {
  onEndTrip: (tripDuration: number, tripStartTime: string) => void; // end trip → open income form
  onExpense: () => void;   // add expense directly
  onClose: () => void;     // cancel / close without entry
  autoStart?: boolean;     // if true, start trip timer immediately on mount
}

function formatStopwatch(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function TripTimerDialog({ onEndTrip, onExpense, onClose, autoStart }: Props) {
  const t = useT();
  const [running, setRunning] = useState(false);
  const [tripStart, setTripStart] = useState<number | null>(null);
  const [tripStartISO, setTripStartISO] = useState<string>('');
  const [elapsed, setElapsed] = useState(0);

  // Auto-start when opened from "รับงาน" button
  useEffect(() => {
    if (autoStart) {
      const now = Date.now();
      const nowISO = new Date().toISOString();
      setTripStart(now);
      setTripStartISO(nowISO);
      setRunning(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - tripStart!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [running, tripStart]);

  const handleStart = () => {
    const now = Date.now();
    const nowISO = new Date().toISOString();
    setTripStart(now);
    setTripStartISO(nowISO);
    setRunning(true);
  };

  const handleEnd = () => {
    const duration = Math.floor((Date.now() - tripStart!) / 1000);
    onEndTrip(duration, tripStartISO);
  };

  const handleCancelTrip = () => {
    setRunning(false);
    setTripStart(null);
    setElapsed(0);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={!running ? onClose : undefined}
    >
      <div
        className="w-full max-w-[430px] bg-card/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[2rem] p-6 space-y-5 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-extrabold text-white">{t('timer_new_trip')}</h2>
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

        {/* Buttons */}
        {!running ? (
          <div className="space-y-3">
            {/* Start */}
            <button
              onClick={handleStart}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-[#00b050] text-white font-extrabold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
            >
              <Play size={20} fill="white" />
              {t('timer_start')}
            </button>

            {/* Add Expense */}
            <button
              onClick={onExpense}
              className="w-full py-3.5 rounded-2xl bg-secondary border border-white/5 text-muted-foreground hover:text-white hover:border-white/10 font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Receipt size={16} />
              {t('timer_add_expense')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Cancel Trip */}
            <button
              onClick={handleCancelTrip}
              className="py-4 rounded-2xl bg-secondary border border-white/5 text-muted-foreground hover:text-destructive hover:border-destructive/30 font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <XCircle size={18} />
              {t('timer_cancel_trip')}
            </button>

            {/* End Trip */}
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
