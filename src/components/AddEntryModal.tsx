import { useState } from 'react';
import { Entry } from '@/lib/types';

const EXPENSE_CATEGORIES = ['Fuel', 'Charging', 'Food', 'Parking', 'Maintenance', 'Other'];

interface Props {
  onSave: (entry: Omit<Entry, 'id' | 'sessionId' | 'timestamp'>) => void;
  onClose: () => void;
}

export default function AddEntryModal({ onSave, onClose }: Props) {
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [appFare, setAppFare] = useState('');
  const [customerPaid, setCustomerPaid] = useState('');
  const [driverReceived, setDriverReceived] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const fareNum = parseFloat(appFare) || 0;
  const paidNum = parseFloat(customerPaid) || 0;
  const driverNet = parseFloat(driverReceived) || 0;
  const tip = Math.max(0, paidNum - fareNum);
  const appDeducted = Math.max(0, fareNum - driverNet);
  const appDeductedPct = fareNum > 0 ? (appDeducted / fareNum) * 100 : 0;

  const handleSave = () => {
    if (type === 'income') {
      if (!fareNum) return;
      onSave({ type, appFare: fareNum, customerPaid: paidNum, tip, driverNet, amount: fareNum, note });
    } else {
      const expAmount = parseFloat(amount) || 0;
      if (!expAmount) return;
      onSave({ type, expenseCategory, amount: expAmount, note });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-[430px] bg-card/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[2rem] p-6 space-y-6 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-extrabold text-white">Add Entry</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors bg-white/5 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* Type Toggle */}
        <div className="flex bg-secondary/50 p-1.5 rounded-2xl border border-white/5">
          {(['income', 'expense'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${type === t
                  ? t === 'income' ? 'bg-primary text-white shadow-md scale-[0.98]' : 'bg-destructive text-white shadow-md scale-[0.98]'
                  : 'text-muted-foreground hover:text-white'
                }`}
            >
              {t === 'income' ? 'Income' : 'Expense'}
            </button>
          ))}
        </div>

        {type === 'income' ? (
          <div className="space-y-4">
            <InputField label="App Fare" prefix="฿" value={appFare} onChange={setAppFare} />
            <InputField label="Customer Paid" prefix="฿" value={customerPaid} onChange={setCustomerPaid} />
            <InputField label="Driver Received" prefix="฿" value={driverReceived} onChange={setDriverReceived} />
            {tip > 0 && (
              <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 text-center">
                <span className="text-warning font-mono font-bold">Tip: ฿{tip.toFixed(0)}</span>
              </div>
            )}
            {(fareNum > 0 && driverNet > 0) && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
                <span className="text-destructive font-mono font-bold">App Deducted: ฿{appDeducted.toFixed(0)} ({appDeductedPct.toFixed(1)}%)</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <select
                value={expenseCategory}
                onChange={e => setExpenseCategory(e.target.value)}
                className="w-full bg-secondary text-foreground rounded-lg p-2.5 text-sm border border-border"
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <InputField label="Amount" prefix="฿" value={amount} onChange={setAmount} />
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Note (optional)</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full bg-secondary text-foreground rounded-lg p-2.5 text-sm border border-border"
            placeholder="Add a note..."
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-[#00b050] text-white font-extrabold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
        >
          Save Entry
        </button>
      </div>
    </div>
  );
}

function InputField({ label, prefix, value, onChange }: { label: string; prefix: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block px-1">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base font-medium">{prefix}</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-input/40 focus:bg-input/80 text-white rounded-xl p-3.5 pl-10 text-base font-mono border border-white/5 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50 outline-none"
          placeholder="0"
        />
      </div>
    </div>
  );
}
