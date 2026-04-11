import { useState, useEffect } from 'react';
import { Entry } from '@/lib/types';
import { getProfile } from '@/lib/storage';
import { getFuelPrice } from '@/lib/fuelApi';
import { Loader2 } from 'lucide-react';

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

  // Fuel-specific state
  const [fuelPrice, setFuelPrice] = useState<number | null>(null);
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelLoading, setFuelLoading] = useState(false);

  const profile = getProfile();
  const isFuelSelected = type === 'expense' && expenseCategory === 'Fuel';

  // Fetch fuel price when Fuel category is selected
  useEffect(() => {
    if (!isFuelSelected) return;
    if (fuelPrice !== null) return; // already fetched
    if (!profile?.fuelType) return; // electric or not set

    setFuelLoading(true);
    getFuelPrice(profile.fuelType)
      .then(price => setFuelPrice(price))
      .finally(() => setFuelLoading(false));
  }, [isFuelSelected, profile?.fuelType]);

  // Auto-calculate amount from liters × price
  useEffect(() => {
    if (isFuelSelected && fuelPrice !== null && fuelLiters !== '') {
      const liters = parseFloat(fuelLiters) || 0;
      setAmount((liters * fuelPrice).toFixed(2));
    }
  }, [fuelLiters, fuelPrice, isFuelSelected]);

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
      const extra: Partial<Entry> = {};
      if (isFuelSelected && fuelPrice !== null) {
        extra.fuelPrice = fuelPrice;
        extra.fuelLiters = parseFloat(fuelLiters) || 0;
      }
      onSave({ type, expenseCategory, amount: expAmount, note, ...extra });
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
                onChange={e => {
                  setExpenseCategory(e.target.value);
                  setAmount('');
                  setFuelLiters('');
                }}
                className="w-full bg-secondary text-foreground rounded-lg p-2.5 text-sm border border-border"
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Fuel-specific: price + liters calculator */}
            {isFuelSelected && (
              <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Fuel Price</span>
                  {fuelLoading ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" /> Fetching...
                    </span>
                  ) : fuelPrice !== null ? (
                    <span className="font-mono font-bold text-primary text-sm">
                      ฿{fuelPrice.toFixed(2)}/L
                      {profile?.fuelType && (
                        <span className="text-muted-foreground font-normal ml-1">({profile.fuelType.toUpperCase()})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Set fuel type in Profile</span>
                  )}
                </div>

                {fuelPrice !== null && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block px-1">Liters Filled</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={fuelLiters}
                          onChange={e => setFuelLiters(e.target.value)}
                          className="w-full bg-input/40 focus:bg-input/80 text-white rounded-xl p-3.5 pr-10 text-base font-mono border border-white/5 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50 outline-none"
                          placeholder="0.00"
                          step="0.01"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">L</span>
                      </div>
                    </div>
                    {parseFloat(fuelLiters) > 0 && (
                      <div className="bg-black/20 rounded-xl p-3 flex justify-between items-center border border-white/5">
                        <span className="text-xs text-muted-foreground">{fuelLiters}L × ฿{fuelPrice.toFixed(2)}</span>
                        <span className="font-mono font-bold text-white text-sm">= ฿{(parseFloat(fuelLiters) * fuelPrice).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <InputField
              label={isFuelSelected && fuelPrice !== null ? 'Total Amount (auto-calculated)' : 'Amount'}
              prefix="฿"
              value={amount}
              onChange={setAmount}
              readOnly={isFuelSelected && fuelPrice !== null && parseFloat(fuelLiters) > 0}
            />
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

function InputField({ label, prefix, value, onChange, readOnly }: { label: string; prefix: string; value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block px-1">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base font-medium">{prefix}</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          readOnly={readOnly}
          className={`w-full bg-input/40 text-white rounded-xl p-3.5 pl-10 text-base font-mono border border-white/5 transition-all placeholder:text-muted-foreground/50 outline-none ${
            readOnly ? 'opacity-70 cursor-default' : 'focus:bg-input/80 focus:border-primary/50'
          }`}
          placeholder="0"
        />
      </div>
    </div>
  );
}
