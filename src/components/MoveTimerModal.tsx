import { X, RotateCcw, Pause, Play } from 'lucide-react';
import { useT } from '@/context/LangContext';

interface Props {
  secondsLeft: number;
  totalSeconds: number;
  isPaused: boolean;
  isDone: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onClose: () => void;
}

export default function MoveTimerModal({
  secondsLeft,
  totalSeconds,
  isPaused,
  isDone,
  onPause,
  onResume,
  onReset,
  onClose,
}: Props) {
  const t = useT();

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const ss = (secondsLeft % 60).toString().padStart(2, '0');

  // SVG circular progress
  const r = 76;
  const circ = 2 * Math.PI * r;
  const pct = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const dash = pct * circ;

  const strokeColor = isDone
    ? '#ef4444'
    : isPaused
    ? 'rgba(0,242,96,0.45)'
    : '#00f260';

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] bg-card border-t border-white/10 rounded-t-3xl shadow-2xl p-6 pb-10 flex flex-col gap-6 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">{t('move_timer_title')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-white rounded-xl hover:bg-white/10 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Circular countdown */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-52 h-52 flex items-center justify-center">
            {/* bg glow */}
            <div className={`absolute inset-0 rounded-full blur-3xl opacity-10 transition-colors duration-500 ${isDone ? 'bg-destructive' : 'bg-primary'}`} />
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
              {/* track */}
              <circle
                cx="100" cy="100" r={r}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="14"
              />
              {/* progress */}
              <circle
                cx="100" cy="100" r={r}
                fill="none"
                stroke={strokeColor}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ transition: 'stroke-dasharray 0.8s linear, stroke 0.3s ease' }}
              />
            </svg>

            {/* Center text */}
            <div className="text-center z-10 select-none">
              {isDone ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-5xl">⏰</span>
                  <p className="text-lg font-extrabold text-destructive leading-tight">
                    {t('move_timer_done_title')}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[52px] font-mono font-extrabold text-white tabular-nums leading-none">
                    {mm}:{ss}
                  </p>
                  {isPaused && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                      หยุดชั่วคราว
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {isDone && (
            <p className="text-sm text-muted-foreground text-center">{t('move_timer_done_desc')}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-secondary border border-white/10 text-sm font-bold text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
          >
            <RotateCcw size={16} /> {t('move_timer_reset')}
          </button>

          {!isDone && (
            <button
              onClick={isPaused ? onResume : onPause}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                isPaused
                  ? 'bg-gradient-to-r from-primary to-[#00b050] text-white shadow-lg shadow-primary/20'
                  : 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
              }`}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
              {isPaused ? t('move_timer_resume') : t('move_timer_pause')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
