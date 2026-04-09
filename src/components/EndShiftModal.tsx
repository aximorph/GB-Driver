import { useState } from 'react';
import { ShiftSession } from '@/lib/types';

interface Props {
  session: ShiftSession;
  onConfirm: (grabPayout: number) => void;
  onClose: () => void;
}

export default function EndShiftModal({ session, onConfirm, onClose }: Props) {
  const [grabPayout, setGrabPayout] = useState('');

  const calcGross = session.entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + (e.driverNet || 0), 0);

  const payoutNum = parseFloat(grabPayout) || 0;
  const diff = payoutNum - calcGross;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[430px] bg-card border border-border rounded-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">End Shift</h2>

        <div className="bg-secondary rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Calculated Gross Earnings</p>
          <p className="font-mono text-2xl font-bold text-primary">฿{calcGross.toFixed(0)}</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Grab payout amount (from app)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
            <input
              type="number"
              value={grabPayout}
              onChange={e => setGrabPayout(e.target.value)}
              className="w-full bg-secondary text-foreground rounded-lg p-2.5 pl-8 text-sm font-mono border border-border"
              placeholder="0"
            />
          </div>
        </div>

        {payoutNum > 0 && (
          <div className={`rounded-lg p-2 text-center ${diff >= 0 ? 'bg-primary/10 border border-primary/20' : 'bg-destructive/10 border border-destructive/20'}`}>
            <span className={`font-mono font-bold text-sm ${diff >= 0 ? 'text-primary' : 'text-destructive'}`}>
              Difference: {diff >= 0 ? '+' : ''}฿{diff.toFixed(0)}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold text-sm">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(payoutNum)}
            className="flex-1 py-3 rounded-lg bg-destructive text-destructive-foreground font-semibold text-sm hover:bg-destructive/90 transition-colors"
          >
            Confirm & End
          </button>
        </div>
      </div>
    </div>
  );
}
