import { useState } from 'react';
import { ShiftSession } from '@/lib/types';
import { useT } from '@/context/LangContext';
import { Clock, Activity, Coffee } from 'lucide-react';

interface Props {
  session: ShiftSession;
  onConfirm: (grabPayout: number) => void;
  onClose: () => void;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function EndShiftModal({ session, onConfirm, onClose }: Props) {
  const t = useT();
  const [grabPayout, setGrabPayout] = useState('');

  // Only Grab trips — excludes bolt, vip, etc, and intensive bonuses
  const grabCalc = session.entries
    .filter(e =>
      e.type === 'income' &&
      !e.note?.startsWith('Intensive:') &&
      e.platform !== 'bolt' &&
      e.platform !== 'vip' &&
      e.platform !== 'etc',
    )
    .reduce((sum, e) => sum + (e.driverNet || 0), 0);

  const payoutNum = parseFloat(grabPayout) || 0;
  const diff      = Math.round(payoutNum - grabCalc); // round to avoid float dust

  // ── Time breakdown ─────────────────────────────────────────────────────────
  const now = new Date();
  const shiftStart = new Date(session.startTime);
  const onlineSecs = Math.floor((now.getTime() - shiftStart.getTime()) / 1000);

  // Sum of trip durations for income entries that have it (non-bonus)
  const workingSecs = session.entries
    .filter(e => e.type === 'income' && !e.note?.startsWith('Intensive:') && (e.tripDuration ?? 0) > 0)
    .reduce((sum, e) => sum + (e.tripDuration ?? 0), 0);

  const waitingSecs = Math.max(0, onlineSecs - workingSecs);
  const hasTimeData = workingSecs > 0;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[430px] bg-card border border-border rounded-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">{t('end_title')}</h2>

        {/* Grab calculated vs payout comparison */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-secondary rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground leading-tight mb-1">{t('end_calc_grab_only')}</p>
            <p className="font-mono text-xl font-bold text-primary">฿{grabCalc.toFixed(0)}</p>
          </div>
          <div className="bg-secondary rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] text-muted-foreground">{t('end_grab_payout')}</p>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">฿</span>
              <input
                type="number"
                value={grabPayout}
                onChange={e => setGrabPayout(e.target.value)}
                className="w-full bg-black/20 text-foreground rounded-lg py-1.5 pl-6 pr-2 text-sm font-mono border border-white/10 outline-none focus:border-primary/40 transition-colors"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Difference + auto-save hint */}
        {payoutNum > 0 && diff !== 0 && (
          <div className={`rounded-xl p-3 space-y-1.5 ${diff > 0 ? 'bg-primary/8 border border-primary/20' : 'bg-destructive/8 border border-destructive/20'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('end_difference')}</span>
              <span className={`font-mono font-bold text-base ${diff > 0 ? 'text-primary' : 'text-destructive'}`}>
                {diff > 0 ? '+' : ''}฿{diff}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t('end_adjustment_hint')}
            </p>
          </div>
        )}

        {/* ── Time Breakdown ─────────────────────────────────────────────── */}
        <div className="bg-secondary/60 rounded-xl border border-white/5 p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('time_breakdown')}</p>
          <div className="grid grid-cols-3 gap-2">
            <TimeStatBox
              icon={<Clock size={14} />}
              label={t('time_online')}
              value={formatDuration(onlineSecs)}
              color="text-white"
            />
            <TimeStatBox
              icon={<Activity size={14} />}
              label={t('time_working')}
              value={hasTimeData ? formatDuration(workingSecs) : '—'}
              color="text-primary"
            />
            <TimeStatBox
              icon={<Coffee size={14} />}
              label={t('time_waiting')}
              value={hasTimeData ? formatDuration(waitingSecs) : '—'}
              color="text-warning"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold text-sm">
            {t('end_cancel')}
          </button>
          <button
            onClick={() => onConfirm(payoutNum)}
            className="flex-1 py-3 rounded-lg bg-destructive text-destructive-foreground font-semibold text-sm hover:bg-destructive/90 transition-colors"
          >
            {t('end_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeStatBox({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-black/20 rounded-xl p-3 text-center border border-white/5 space-y-1">
      <div className={`flex justify-center ${color} opacity-70`}>{icon}</div>
      <p className={`font-mono font-bold text-sm ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
