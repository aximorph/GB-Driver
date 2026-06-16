import { useState, useEffect } from 'react';
import { Entry } from '@/lib/types';
import { getProfile } from '@/lib/storage';
import { getFuelPrice } from '@/lib/fuelApi';
import { Loader2, Timer, ChevronDown } from 'lucide-react';
import { useT } from '@/context/LangContext';
import type { TranslationKey } from '@/lib/i18n';

// Keys stay in English (stored in data); labels come from i18n
const EXPENSE_CATEGORIES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'Fuel',        labelKey: 'cat_fuel' },
  { value: 'Charging',    labelKey: 'cat_charging' },
  { value: 'Food',        labelKey: 'cat_food' },
  { value: 'Parking',     labelKey: 'cat_parking' },
  { value: 'Maintenance', labelKey: 'cat_maintenance' },
  { value: 'Other',       labelKey: 'cat_other' },
];

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

interface Props {
  initialType?: 'income' | 'expense';
  initialTripDuration?: number;   // seconds from TripTimerDialog
  initialTripStartTime?: string;  // ISO timestamp
  lockedPlatform?: 'grab' | 'bolt' | 'vip'; // platform already chosen in TripTimerDialog — shown read-only
  editEntry?: Entry;              // if provided → edit mode (pre-fills all fields)
  onSave: (entry: Omit<Entry, 'id' | 'sessionId' | 'timestamp'>) => void;
  onUpdate?: (id: string, entry: Omit<Entry, 'id' | 'sessionId' | 'timestamp'>) => void;
  onClose: () => void;
}

export default function AddEntryModal({
  initialType = 'income',
  initialTripDuration,
  initialTripStartTime,
  lockedPlatform,
  editEntry,
  onSave,
  onUpdate,
  onClose,
}: Props) {
  const t = useT();
  const isEditMode = !!editEntry;
  // Platform was already picked in TripTimerDialog — show read-only badge instead of selector.
  // Only applies to brand-new income entries (not edit mode, not the claim/etc flow).
  const isPlatformLocked = !isEditMode && !!lockedPlatform;

  // In edit mode seed state from the existing entry
  const [type, setType] = useState<'income' | 'expense'>(editEntry?.type ?? initialType);
  const [platform, setPlatform] = useState<'grab' | 'bolt' | 'vip' | 'etc'>(
    editEntry?.platform ?? lockedPlatform ?? 'grab'
  );
  const [orderType, setOrderType] = useState<'ride' | 'express'>(editEntry?.orderType ?? 'ride');
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'credit' | ''>(editEntry?.paymentType ?? '');
  const [appFare, setAppFare] = useState(editEntry?.appFare?.toString() ?? '');
  // customerPaid: only pre-fill if it differs from appFare (tip scenario)
  const [customerPaid, setCustomerPaid] = useState(
    editEntry && editEntry.customerPaid !== undefined && editEntry.customerPaid !== editEntry.appFare
      ? editEntry.customerPaid.toString()
      : ''
  );
  const [driverReceived, setDriverReceived] = useState(editEntry?.driverNet?.toString() ?? '');
  const [expenseCategory, setExpenseCategory] = useState(editEntry?.expenseCategory ?? EXPENSE_CATEGORIES[0].value);
  const [amount, setAmount] = useState(
    editEntry?.type === 'expense' ? (editEntry.amount?.toString() ?? '') : ''
  );
  const [note, setNote] = useState(editEntry?.note ?? '');
  const [showNote, setShowNote] = useState(!!(editEntry?.note));

  // Fuel-specific state
  const [fuelPrice, setFuelPrice] = useState<number | null>(null);
  const [fuelLoading, setFuelLoading] = useState(false);

  const profile = getProfile();
  const isFuelSelected = type === 'expense' && expenseCategory === 'Fuel';
  const isVIP = type === 'income' && platform === 'vip';
  const isEtc = type === 'income' && platform === 'etc';

  // Entries that are always credit: etc (claim/adjustment) entries
  // Intensive bonus entries (note starts with "Intensive:") are always credit too,
  // but those are added programmatically — not through this modal.
  const isAlwaysCredit = isEtc;

  // Effective payment type for saving:
  // - etc platform → always credit
  // - vip platform → only cash or transfer (no credit option)
  // - grab/bolt → cash/transfer/credit as selected
  const effectivePaymentType: 'cash' | 'transfer' | 'credit' | '' = isAlwaysCredit
    ? 'credit'
    : paymentType;

  useEffect(() => {
    if (!isFuelSelected) {
      setFuelPrice(null);
      return;
    }
    if (!profile?.fuelType) return;
    setFuelLoading(true);
    getFuelPrice(profile.fuelType)
      .then(price => setFuelPrice(price))
      .finally(() => setFuelLoading(false));
  }, [isFuelSelected, profile?.fuelType]);

  const fuelLiters =
    isFuelSelected && fuelPrice && fuelPrice > 0 && parseFloat(amount) > 0
      ? (parseFloat(amount) / fuelPrice).toFixed(2)
      : null;

  const fareNum = parseFloat(appFare) || 0;
  const paidNum = customerPaid !== '' ? (parseFloat(customerPaid) || 0) : fareNum;
  const driverNet = parseFloat(driverReceived) || 0;
  const tip = Math.max(0, paidNum - fareNum);
  const appDeducted = Math.max(0, fareNum - driverNet);
  const appDeductedPct = fareNum > 0 ? (appDeducted / fareNum) * 100 : 0;

  // Trip duration to display in header (read-only in edit mode)
  const displayTripDuration = isEditMode ? editEntry?.tripDuration : initialTripDuration;
  const displayTripStartTime = isEditMode ? editEntry?.tripStartTime : initialTripStartTime;

  const handleSave = () => {
    if (type === 'income') {
      // VIP / etc: only driverNet matters, no app fare or tip
      if (isVIP || isEtc) {
        const net = parseFloat(driverReceived) || 0;
        if (!net) return;
        const payload: Omit<Entry, 'id' | 'sessionId' | 'timestamp'> = {
          type,
          platform,
          appFare: 0,
          customerPaid: 0,
          tip: 0,
          driverNet: net,
          amount: net,
          note,
          // Preserve trip timer data (VIP trips can also be timed)
          ...(displayTripDuration !== undefined && {
            tripDuration: displayTripDuration,
            tripStartTime: displayTripStartTime,
          }),
          ...(effectivePaymentType && { paymentType: effectivePaymentType }),
        };
        if (isEditMode && onUpdate) { onUpdate(editEntry!.id, payload); }
        else { onSave(payload); }
        return;
      }
      if (!fareNum) return;
      const payload: Omit<Entry, 'id' | 'sessionId' | 'timestamp'> = {
        type,
        platform,
        orderType,
        appFare: fareNum,
        customerPaid: paidNum,
        tip,
        driverNet,
        amount: fareNum,
        note,
        // Preserve trip timer — never overwritten in edit mode
        ...(displayTripDuration !== undefined && {
          tripDuration: displayTripDuration,
          tripStartTime: displayTripStartTime,
        }),
        ...(paymentType && (platform === 'grab' || platform === 'bolt') && { paymentType }),
      };
      if (isEditMode && onUpdate) {
        onUpdate(editEntry!.id, payload);
      } else {
        onSave(payload);
      }
    } else {
      const expAmount = parseFloat(amount) || 0;
      if (!expAmount) return;
      const extra: Partial<Entry> = {};
      if (isFuelSelected && fuelPrice !== null && fuelLiters !== null) {
        extra.fuelPrice = fuelPrice;
        extra.fuelLiters = parseFloat(fuelLiters);
      }
      const payload: Omit<Entry, 'id' | 'sessionId' | 'timestamp'> = {
        type, expenseCategory, amount: expAmount, note, ...extra,
      };
      if (isEditMode && onUpdate) {
        onUpdate(editEntry!.id, payload);
      } else {
        onSave(payload);
      }
    }
  };

  // Shared save/update button
  const saveBtn = (
    <button
      onClick={handleSave}
      className="shrink-0 self-end h-[44px] px-4 rounded-xl bg-gradient-to-r from-primary to-[#00b050] text-white font-extrabold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.97] transition-transform"
    >
      {isEditMode ? t('add_update') : t('add_save')}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center" onClick={onClose}>
      <div
        className="w-full max-w-[430px] bg-card/95 backdrop-blur-3xl border-b border-white/10 rounded-b-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] animate-in slide-in-from-top max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-white">
              {isEditMode ? t('add_edit_title') : t('add_title')}
            </h2>
            {/* Type badge */}
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
              type === 'income'
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'bg-destructive/15 text-destructive border border-destructive/25'
            }`}>
              {type === 'income' ? t('add_income') : t('add_expense')}
            </span>
            {/* Trip duration badge (read-only) */}
            {displayTripDuration !== undefined && displayTripDuration > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-primary/70 bg-primary/10 border border-primary/15 px-2 py-0.5 rounded-lg">
                <Timer size={11} />
                {formatDuration(displayTripDuration)}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors bg-white/5 rounded-full w-7 h-7 flex items-center justify-center text-sm">✕</button>
        </div>

        {/* ── Scrollable content ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2.5 pb-4">

          {type === 'income' ? (
            <div className="space-y-2.5">
              {/* Platform — selector when free to choose, read-only badge when locked from TripTimerDialog */}
              {isPlatformLocked ? (
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('timer_platform_label')}:</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    platform === 'bolt' ? 'text-violet-400 bg-violet-400/15 border-violet-400/20'
                    : platform === 'vip' ? 'text-pink-400 bg-pink-400/15 border-pink-400/20'
                    : 'text-primary bg-primary/15 border-primary/20'
                  }`}>
                    {platform === 'bolt' ? t('add_bolt') : platform === 'vip' ? t('add_vip') : t('add_grab')}
                  </span>
                </div>
              ) : (
                <div className="flex bg-secondary/60 p-1 rounded-xl border border-white/5 gap-1">
                  {([
                    { value: 'grab' as const, label: t('add_grab'), cls: 'text-primary border-primary/30 bg-primary/20' },
                    { value: 'bolt' as const, label: t('add_bolt'), cls: 'text-violet-400 border-violet-400/30 bg-violet-400/15' },
                    { value: 'vip'  as const, label: t('add_vip'),  cls: 'text-pink-400 border-pink-400/30 bg-pink-400/15' },
                  ]).map(p => (
                    <button key={p.value} onClick={() => setPlatform(p.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        platform === p.value ? `${p.cls} border` : 'text-muted-foreground hover:text-white'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Order type selector — hidden for VIP/etc */}
              {!isVIP && !isEtc && (
                <div className="flex bg-secondary/60 p-1 rounded-xl border border-white/5 gap-1">
                  {([
                    { value: 'ride' as const, labelKey: 'add_taxi' as const },
                    { value: 'express' as const, labelKey: 'add_express' as const },
                  ]).map(o => (
                    <button key={o.value} onClick={() => setOrderType(o.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        orderType === o.value ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground hover:text-white'
                      }`}>
                      {t(o.labelKey)}
                    </button>
                  ))}
                </div>
              )}

              {/* Payment type selector */}
              {/* etc = always credit (show badge, no selector)  */}
              {/* vip = cash or transfer only                     */}
              {/* grab/bolt = cash / transfer / credit            */}
              {isEtc ? (
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('add_payment_type')}:</span>
                  <span className="text-[10px] font-bold text-violet-400 bg-violet-500/15 border border-violet-500/20 px-2 py-0.5 rounded-md">{t('add_pay_credit')}</span>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1.5">{t('add_payment_type')}</p>
                  <div className="flex bg-secondary/60 p-1 rounded-xl border border-white/5 gap-1">
                    {(isVIP
                      ? [
                          { value: 'cash'     as const, labelKey: 'add_pay_cash'     as const },
                          { value: 'transfer' as const, labelKey: 'add_pay_transfer' as const },
                        ]
                      : [
                          { value: 'cash'     as const, labelKey: 'add_pay_cash'     as const },
                          { value: 'transfer' as const, labelKey: 'add_pay_transfer' as const },
                          { value: 'credit'   as const, labelKey: 'add_pay_credit'   as const },
                        ]
                    ).map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPaymentType(prev => prev === p.value ? '' : p.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentType === p.value
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-white'
                        }`}
                      >
                        {t(p.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning: no intensive */}
              {(orderType === 'express' || platform === 'bolt' || isVIP) && (
                <p className="text-[11px] text-warning/80 px-1">
                  ⚠ {isVIP
                    ? t('add_vip_warn')
                    : orderType === 'express' && platform === 'bolt'
                    ? t('add_bolt_express_warn')
                    : orderType === 'express'
                    ? t('add_express_only_warn')
                    : t('add_bolt_only_warn')} {t('add_no_intensive')}
                </p>
              )}

              {/* VIP / etc: simplified — only driverNet */}
              {(isVIP || isEtc) ? (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <InputField label={t('add_vip_driver_received')} prefix="฿" value={driverReceived} onChange={setDriverReceived} />
                  </div>
                  {saveBtn}
                </div>
              ) : (
                <>
                  {/* App Fare + Customer Paid */}
                  <div className="grid grid-cols-2 gap-2">
                    <InputField label={t('add_app_fare')} prefix="฿" value={appFare} onChange={setAppFare} />
                    <InputField
                      label={t('add_customer_paid')}
                      prefix="฿"
                      value={customerPaid}
                      onChange={setCustomerPaid}
                      placeholder={fareNum > 0 ? fareNum.toFixed(0) : '0'}
                    />
                  </div>

                  {/* Driver Received + Save inline */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <InputField label={t('add_driver_received')} prefix="฿" value={driverReceived} onChange={setDriverReceived} />
                    </div>
                    {saveBtn}
                  </div>

                  {/* Tip + App deduction */}
                  {(tip > 0 || (fareNum > 0 && driverNet > 0 && appDeducted > 0)) && (
                    <div className="flex items-center gap-3 px-1">
                      {tip > 0 && (
                        <span className="text-xs font-mono font-bold text-warning">
                          {t('add_tip_label')} +฿{tip.toFixed(0)}
                        </span>
                      )}
                      {fareNum > 0 && driverNet > 0 && appDeducted > 0 && (
                        <span className="text-xs font-mono text-destructive/80">
                          {t('add_app_deducted')} ฿{appDeducted.toFixed(0)} ({appDeductedPct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('add_category')}</label>
                <select
                  value={expenseCategory}
                  onChange={e => { setExpenseCategory(e.target.value); setAmount(''); }}
                  className="w-full bg-secondary text-foreground rounded-lg p-2.5 text-sm border border-border"
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
                </select>
              </div>

              {isFuelSelected && (
                <div className="bg-primary/5 border border-primary/15 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('add_fuel_price_label')}</span>
                    {fuelLoading ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 size={12} className="animate-spin" /> {t('add_fuel_fetching')}
                      </span>
                    ) : fuelPrice !== null ? (
                      <span className="font-mono font-bold text-primary text-sm">
                        ฿{fuelPrice.toFixed(2)}/L
                        {profile?.fuelType && <span className="text-muted-foreground font-normal ml-1">({profile.fuelType.toUpperCase()})</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('add_fuel_set_profile')}</span>
                    )}
                  </div>
                  {fuelLiters !== null && (
                    <div className="bg-black/20 rounded-xl p-2.5 flex justify-between items-center border border-white/5">
                      <span className="text-xs text-muted-foreground">฿{amount} ÷ ฿{fuelPrice?.toFixed(2)}/L</span>
                      <span className="font-mono font-bold text-primary text-sm">≈ {fuelLiters} L</span>
                    </div>
                  )}
                </div>
              )}

              {/* Amount + Save inline */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <InputField label={isFuelSelected ? t('add_amount_paid') : t('add_amount')} prefix="฿" value={amount} onChange={setAmount} />
                </div>
                {saveBtn}
              </div>
            </div>
          )}

          {/* Note — collapsed by default, open if has value */}
          <div>
            <button
              type="button"
              onClick={() => setShowNote(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors py-1"
            >
              <ChevronDown size={13} className={`transition-transform duration-200 ${showNote ? 'rotate-180' : ''}`} />
              {t('add_note_label')}
              {note && !showNote && <span className="ml-1 text-primary font-mono">"{note.slice(0, 20)}{note.length > 20 ? '…' : ''}"</span>}
            </button>
            {showNote && (
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full bg-secondary text-foreground rounded-lg p-2.5 text-sm border border-border mt-1"
                placeholder={t('add_note_placeholder')}
                autoFocus
              />
            )}
          </div>

        </div>{/* end scrollable */}
      </div>
    </div>
  );
}

function InputField({
  label, prefix, value, onChange, readOnly, placeholder,
}: {
  label: string;
  prefix: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block px-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">{prefix}</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder ?? '0'}
          className={`w-full bg-input/40 text-white rounded-xl p-2.5 pl-8 text-sm font-mono border border-white/5 transition-all placeholder:text-muted-foreground/50 outline-none ${
            readOnly ? 'opacity-70 cursor-default' : 'focus:bg-input/80 focus:border-primary/50'
          }`}
        />
      </div>
    </div>
  );
}
