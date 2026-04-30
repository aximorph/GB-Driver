/**
 * ClaimEntryDialog.tsx
 * Simple bottom-sheet for recording claim / misc income (platform = 'etc').
 * Opened from the TripTimerDialog "เครม / อื่นๆ" button.
 */
import { useState } from 'react';
import { Coins } from 'lucide-react';
import { Entry } from '@/lib/types';
import { useT } from '@/context/LangContext';

interface Props {
  onSave: (entry: Omit<Entry, 'id' | 'sessionId' | 'timestamp'>) => void;
  onClose: () => void;
}

export default function ClaimEntryDialog({ onSave, onClose }: Props) {
  const t = useT();
  const [note, setNote]     = useState('');
  const [amount, setAmount] = useState('30');

  const canSave = note.trim().length > 0 && (parseFloat(amount) || 0) > 0;

  const handleSave = () => {
    if (!canSave) return;
    const net = parseFloat(amount) || 0;
    onSave({
      type: 'income',
      platform: 'etc',
      appFare: 0,
      customerPaid: 0,
      tip: 0,
      driverNet: net,
      amount: net,
      note: note.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] bg-card/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[2rem] p-6 space-y-5 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
              <Coins size={20} className="text-amber-400" />
            </div>
            <h2 className="text-lg font-extrabold text-white">{t('claim_title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white transition-colors bg-white/5 rounded-full w-8 h-8 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Note field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
            {t('claim_note_label')}
          </label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('claim_note_placeholder')}
            autoFocus
            className="w-full bg-input/40 text-white rounded-xl p-3 text-sm border border-white/5 outline-none focus:bg-input/80 focus:border-amber-400/40 transition-all placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Amount field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
            {t('claim_amount_label')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">฿</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0"
              className="w-full bg-input/40 text-white rounded-xl p-3 pl-8 text-sm font-mono border border-white/5 outline-none focus:bg-input/80 focus:border-amber-400/40 transition-all"
            />
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full py-3.5 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-400 font-extrabold text-sm hover:bg-amber-400/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('claim_save')}
        </button>
      </div>
    </div>
  );
}
