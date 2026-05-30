import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverProfile, Intensive, IntensiveTier, IntensiveCountsFor } from '@/lib/types';
import { THAI_PROVINCES } from '@/lib/provinces';
import { getProfile, saveProfile, saveSessions, getSessions } from '@/lib/storage';
import { Zap, Fuel, Cloud, CheckCircle2, LogIn, RefreshCw, LogOut, Download, Trash2, Plus, Target, Gift, X, ChevronRight, Clock3, Globe, CalendarDays, Timer, UserX, ShieldAlert, Moon, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { initGoogleIdentity, requestGoogleLogin, backupDataToDrive, restoreFromDrive, isGoogleConnected, disconnectGoogle } from '@/lib/googleDrive';
import { getAuthMode, setAuthMode, isGuestMode } from '@/lib/auth';
import SweetAlert from '@/components/SweetAlert';
import { useLang, useT } from '@/context/LangContext';
import type { Lang } from '@/lib/i18n';
import { useIsLandscape } from '@/hooks/useIsLandscape';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}


// ─── 24-hour Time Picker ─────────────────────────────────────────────────────
function TimePicker24({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(':').map(Number);

  const setH = (val: string) => {
    const n = Math.min(23, Math.max(0, parseInt(val) || 0));
    onChange(`${n.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };
  const setM = (val: string) => {
    const n = Math.min(59, Math.max(0, parseInt(val) || 0));
    onChange(`${h.toString().padStart(2, '0')}:${n.toString().padStart(2, '0')}`);
  };

  const inputCls = 'w-12 bg-secondary border border-white/10 rounded-xl py-2 text-sm font-mono text-white text-center outline-none focus:border-primary/50 transition-colors';

  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min={0} max={23}
        value={h.toString().padStart(2, '0')}
        onChange={e => setH(e.target.value)}
        className={inputCls}
      />
      <span className="text-white font-bold text-base">:</span>
      <input
        type="number" min={0} max={59}
        value={m.toString().padStart(2, '0')}
        onChange={e => setM(e.target.value)}
        className={inputCls}
      />
    </div>
  );
}

// ─── Intensive Modal ──────────────────────────────────────────────────────────
interface IntensiveModalProps {
  initial?: Intensive;
  onSave: (intensive: Intensive) => void;
  onClose: () => void;
  t: (key: import('@/lib/i18n').TranslationKey) => string;
}

function IntensiveModal({ initial, onSave, onClose, t }: IntensiveModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [tiers, setTiers] = useState<IntensiveTier[]>(
    initial?.tiers ?? [{ trips: 0, bonus: 0 }]
  );
  const [countsFor, setCountsFor] = useState<IntensiveCountsFor>(initial?.countsFor ?? 'ride');
  const [hasTimeWindow, setHasTimeWindow] = useState(!!(initial?.startTime || initial?.endTime));
  const [startTime, setStartTime] = useState(initial?.startTime ?? '15:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '20:00');

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDateEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];
  const [hasDateRange, setHasDateRange] = useState(!!(initial?.dateStart || initial?.dateEnd));
  const [dateStart, setDateStart] = useState(initial?.dateStart ?? todayStr);
  const [dateEnd, setDateEnd] = useState(initial?.dateEnd ?? defaultDateEnd);

  const addTier = () => setTiers(t => [...t, { trips: 0, bonus: 0 }]);
  const removeTier = (i: number) => setTiers(t => t.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: keyof IntensiveTier, val: string) => {
    setTiers(t => t.map((tier, idx) =>
      idx === i ? { ...tier, [field]: parseFloat(val) || 0 } : tier
    ));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const sorted = [...tiers].sort((a, b) => a.trips - b.trips);
    onSave({
      id: initial?.id ?? generateId(),
      name: name.trim(),
      enabled: initial?.enabled ?? true,
      countsFor,
      startTime: hasTimeWindow ? startTime : undefined,
      endTime: hasTimeWindow ? endTime : undefined,
      dateStart: hasDateRange ? dateStart : undefined,
      dateEnd: hasDateRange ? dateEnd : undefined,
      tiers: sorted,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] bg-card border-t border-white/10 rounded-t-3xl shadow-2xl p-6 pb-10 flex flex-col gap-5 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">
            {initial ? t('modal_edit_intensive') : t('modal_new_intensive')}
          </h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-white rounded-xl hover:bg-white/10 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('modal_intensive_name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('modal_intensive_name_placeholder')}
            className="w-full bg-secondary border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Counts For */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('modal_counts_for')}</label>
          <div className="flex bg-secondary/60 p-1 rounded-2xl border border-white/5 gap-1">
            {([
              { value: 'ride',    labelKey: 'profile_intensive_taxi' },
              { value: 'express', labelKey: 'profile_intensive_express' },
              { value: 'all',     labelKey: 'profile_intensive_all' },
            ] as const).map(opt => (
              <button key={opt.value} type="button" onClick={() => setCountsFor(opt.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  countsFor === opt.value
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-white'
                }`}>
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Time Window (optional) */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setHasTimeWindow(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
              hasTimeWindow
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-secondary border-white/10 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-bold">
              <Clock3 size={15} />
              {t('modal_time_window')}
            </div>
            <div className={`w-10 h-5 rounded-full transition-all relative ${hasTimeWindow ? 'bg-primary' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${hasTimeWindow ? 'left-5' : 'left-0.5'}`} />
            </div>
          </button>
          {hasTimeWindow && (
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="flex flex-col items-center gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('modal_time_start')}</label>
                <TimePicker24 value={startTime} onChange={setStartTime} />
              </div>
              <span className="text-muted-foreground mt-4 text-lg">–</span>
              <div className="flex flex-col items-center gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('modal_time_end')}</label>
                <TimePicker24 value={endTime} onChange={setEndTime} />
              </div>
            </div>
          )}
        </div>

        {/* Date Range (optional) */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setHasDateRange(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
              hasDateRange
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-secondary border-white/10 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-bold">
              <CalendarDays size={15} />
              {t('modal_date_range')}
            </div>
            <div className={`w-10 h-5 rounded-full transition-all relative ${hasDateRange ? 'bg-primary' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${hasDateRange ? 'left-5' : 'left-0.5'}`} />
            </div>
          </button>
          {hasDateRange && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('modal_date_from')}</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="w-full bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('modal_date_to')}</label>
                <input
                  type="date"
                  value={dateEnd}
                  min={dateStart}
                  onChange={e => setDateEnd(e.target.value)}
                  className="w-full bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tiers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('modal_reward_tiers')}</label>
            <button
              onClick={addTier}
              className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Plus size={13} /> {t('modal_add_tier')}
            </button>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2 bg-secondary/40 border border-white/5 rounded-2xl px-3 py-2.5">
                <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                <input
                  type="number" min="0"
                  value={tier.trips || ''}
                  onChange={e => updateTier(i, 'trips', e.target.value)}
                  placeholder="0"
                  className="w-14 bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm font-mono text-white text-center outline-none focus:border-primary/50 transition-colors shrink-0"
                />
                <span className="text-[11px] text-muted-foreground shrink-0">{t('modal_trips_arrow')}</span>
                <input
                  type="number" min="0"
                  value={tier.bonus || ''}
                  onChange={e => updateTier(i, 'bonus', e.target.value)}
                  placeholder="0"
                  className="w-16 bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm font-mono text-white text-center outline-none focus:border-primary/50 transition-colors shrink-0"
                />
                <button
                  onClick={() => removeTier(i)}
                  disabled={tiers.length === 1}
                  className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-20 shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-[#00b050] text-white font-extrabold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:scale-100"
        >
          {t('modal_save_intensive')}
        </button>
      </div>
    </div>
  );
}

// ─── Main ProfilePage ─────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { lang, setLang } = useLang();
  const t = useT();
  const isLandscape = useIsLandscape();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<DriverProfile | null>(getProfile());
  const [vehicleType, setVehicleType] = useState<'electric' | 'petrol'>(profile?.vehicleType || 'petrol');
  const [fuelType, setFuelType] = useState<DriverProfile['fuelType']>(profile?.fuelType || '95');
  const [chargingType, setChargingType] = useState<'home' | 'public'>(profile?.chargingType || 'home');
  const [dailyGoal, setDailyGoal] = useState<string>(profile?.dailyGoal ? String(profile.dailyGoal) : '');
  const [selectedLang, setSelectedLang] = useState<Lang>(profile?.language ?? lang);
  const [province, setProvince] = useState<string>(profile?.province ?? '');
  const [moveTimerMinutes, setMoveTimerMinutes] = useState<number>(profile?.moveTimerMinutes ?? 15);
  const [shiftMode, setShiftMode] = useState<'normal' | 'night'>(profile?.shiftMode ?? 'normal');
  const [shiftStart, setShiftStart] = useState<string>(profile?.shiftStart ?? '07:00');
  const [shiftEnd, setShiftEnd] = useState<string>(profile?.shiftEnd ?? '19:00');

  const [intensives, setIntensives] = useState<Intensive[]>(
    (profile?.intensives ?? []).map(i => ({
      ...i,
      enabled: i.enabled ?? true,
      countsFor: i.countsFor ?? 'ride', // migrate old items
    }))
  );

  const [saved, setSaved] = useState(false);
  const [backingUpAfterSave, setBackingUpAfterSave] = useState(false);
  const [savedAndBacked, setSavedAndBacked] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isAutoRestoring, setIsAutoRestoring] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('gdrive_last_sync'));
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showIntensiveModal, setShowIntensiveModal] = useState(false);
  const [editingIntensive, setEditingIntensive] = useState<Intensive | undefined>(undefined);
  const [deleteIntensiveId, setDeleteIntensiveId] = useState<string | null>(null);

  useEffect(() => { initGoogleIdentity(); }, []);

  const handleSave = async () => {
    const updated: DriverProfile = {
      vehicleType,
      fuelType: vehicleType === 'petrol' ? fuelType : undefined,
      chargingType: vehicleType === 'electric' ? chargingType : undefined,
      commissionRate: profile?.commissionRate || 0.20,
      dailyGoal: dailyGoal ? parseFloat(dailyGoal) : undefined,
      intensives,
      language: selectedLang,
      province: province || undefined,
      moveTimerMinutes,
      shiftStart,
      shiftEnd,
      shiftMode,
    };
    saveProfile(updated);
    setProfile(updated);
    setLang(selectedLang); // Apply language change app-wide
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Auto-backup when in Google mode
    if (!isGuestMode() && isGoogleConnected()) {
      setBackingUpAfterSave(true);
      try {
        await backupDataToDrive();
        const syncTime = new Date().toISOString();
        localStorage.setItem('gdrive_last_sync', syncTime);
        setLastSync(syncTime);
        setSavedAndBacked(true);
        setTimeout(() => setSavedAndBacked(false), 2500);
      } catch (err) {
        console.warn('Auto backup after save failed:', err);
      } finally {
        setBackingUpAfterSave(false);
      }
    }
  };

  // ── Google Drive handlers ──────────────────────────────────────────────────
  const handleGoogleConnect = async () => {
    try {
      await requestGoogleLogin();
      setAuthMode('google');
      setGoogleConnected(true);

      // Auto-restore ONLY when this device has no local data at all.
      // If local sessions exist they are assumed to be newer — skip restore
      // to prevent overwriting data the user hasn't backed up yet.
      const hasLocalData = getSessions().length > 0;
      if (!hasLocalData) {
        setIsAutoRestoring(true);
        try {
          const found = await restoreFromDrive();
          if (found) {
            setProfile(getProfile());
            setTimeout(() => { window.location.reload(); }, 800);
            return; // reload will handle navigation
          }
        } catch (err) {
          console.warn('Auto-restore failed:', err);
        } finally {
          setIsAutoRestoring(false);
        }
      }

      // Navigate to dashboard after successful login
      navigate('/');
    } catch (err) {
      console.error('Google login failed:', err);
      alert(t('alert_google_failed'));
    }
  };

  const handleGoogleDisconnect = () => { disconnectGoogle(); setAuthMode(null); setGoogleConnected(false); };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await backupDataToDrive();
      const syncTime = new Date().toISOString();
      setLastSync(syncTime);
      localStorage.setItem('gdrive_last_sync', syncTime);
    } catch (err) {
      console.error('Backup failed:', err);
      alert(t('alert_backup_failed'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm(t('alert_restore_confirm'))) return;
    setIsRestoring(true);
    try {
      const found = await restoreFromDrive();
      if (found) {
        setProfile(getProfile());
        alert(t('alert_restore_success'));
        window.location.reload();
      } else {
        alert(t('alert_restore_not_found'));
      }
    } catch (err) {
      console.error('Restore failed:', err);
      alert(t('alert_restore_failed'));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearData = () => {
    saveSessions([]);
    localStorage.removeItem('gdrive_last_sync');
    setLastSync(null);
    window.dispatchEvent(new CustomEvent('gbdriver:session-changed'));
    setShowClearConfirm(false);
  };

  // ── Intensive handlers ─────────────────────────────────────────────────────
  const handleSaveIntensive = (intensive: Intensive) => {
    setIntensives(prev => {
      const exists = prev.find(i => i.id === intensive.id);
      return exists ? prev.map(i => i.id === intensive.id ? intensive : i) : [...prev, intensive];
    });
    setShowIntensiveModal(false);
    setEditingIntensive(undefined);
  };

  const handleDeleteIntensive = (id: string) => {
    setIntensives(prev => prev.filter(i => i.id !== id));
    setDeleteIntensiveId(null);
  };

  const toggleIntensive = (id: string) => {
    setIntensives(prev => prev.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i));
  };

  // ── Section variables ──────────────────────────────────────────────────────
  const profileHeader = (
    <>
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-16 -translate-y-16" />
      <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">{t('profile_title')}</h1>
    </>
  );

  const vehicleSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-3 shadow-xl">
      <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase px-1">{t('profile_vehicle_type')}</h3>
      <div className="grid grid-cols-2 gap-3">
        {(['electric', 'petrol'] as const).map(type => (
          <button
            key={type}
            onClick={() => setVehicleType(type)}
            className={`p-4 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-2 ${
              vehicleType === type
                ? 'border-primary bg-primary/10 text-white shadow-inner scale-[0.98]'
                : 'border-white/5 bg-secondary text-muted-foreground hover:border-white/10'
            }`}
          >
            <div className={vehicleType === type ? 'text-primary' : ''}>
              {type === 'electric' ? <Zap size={28} /> : <Fuel size={28} />}
            </div>
            <span className="font-bold text-sm">{type === 'electric' ? t('profile_electric') : t('profile_petrol')}</span>
          </button>
        ))}
      </div>
      <div className={`transition-all duration-300 ease-in-out ${vehicleType === 'petrol' ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/5">
          {(['diesel', '91', '95', 'e20'] as const).map(fuel => (
            <button key={fuel} onClick={() => setFuelType(fuel)}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${fuelType === fuel ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary border border-white/5 text-muted-foreground hover:border-white/10'}`}>
              {fuel.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className={`transition-all duration-300 ease-in-out ${vehicleType === 'electric' ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
          {([
            { value: 'home' as const, labelKey: 'profile_home_charging' as const },
            { value: 'public' as const, labelKey: 'profile_public_charging' as const },
          ]).map(opt => (
            <button key={opt.value} onClick={() => setChargingType(opt.value)}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${chargingType === opt.value ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary border border-white/5 text-muted-foreground hover:border-white/10'}`}>
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const provinceSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-3 shadow-xl">
      <div className="flex items-center gap-2">
        <Globe size={18} className="text-primary" />
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{t('profile_province_title')}</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">{t('profile_province_desc')}</p>
      <select
        value={province}
        onChange={e => setProvince(e.target.value)}
        className="w-full bg-secondary border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors"
      >
        <option value="">{t('profile_province_placeholder')}</option>
        {THAI_PROVINCES.map(p => (
          <option key={p.id} value={p.id}>
            {selectedLang === 'th' ? `${p.th} · ${p.en}` : `${p.en} · ${p.th}`}
          </option>
        ))}
      </select>
    </div>
  );

  // Shift window preview string
  const shiftWindowPreview = (() => {
    const nightLabel = shiftMode === 'night' ? ' (+1)' : '';
    return `${shiftStart} – ${shiftEnd}${nightLabel}`;
  })();

  const shiftSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center gap-2">
        <Clock3 size={18} className="text-primary" />
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{t('profile_shift_title')}</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">{t('profile_shift_desc')}</p>

      {/* Mode toggle */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{t('profile_shift_mode')}</p>
        <div className="flex bg-secondary/60 p-1 rounded-2xl border border-white/5 gap-1">
          {([
            { value: 'normal' as const, label: t('profile_shift_normal'), icon: <Sun size={13} /> },
            { value: 'night'  as const, label: t('profile_shift_night'),  icon: <Moon size={13} /> },
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setShiftMode(opt.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                shiftMode === opt.value
                  ? opt.value === 'night'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
          {shiftMode === 'night' ? t('profile_shift_night_desc') : t('profile_shift_normal_desc')}
        </p>
      </div>

      {/* Time pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('profile_shift_start')}</p>
          <TimePicker24 value={shiftStart} onChange={setShiftStart} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {t('profile_shift_end')}{shiftMode === 'night' && <span className="text-violet-400 ml-1 normal-case">(+1 วัน)</span>}
          </p>
          <TimePicker24 value={shiftEnd} onChange={setShiftEnd} />
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center justify-between bg-secondary/50 border border-white/5 rounded-2xl px-4 py-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('profile_shift_preview')}</span>
        <span className={`font-mono font-bold text-sm ${shiftMode === 'night' ? 'text-violet-300' : 'text-primary'}`}>
          {shiftWindowPreview}
        </span>
      </div>
    </div>
  );

  const timerSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-3 shadow-xl">
      <div className="flex items-center gap-2">
        <Timer size={18} className="text-primary" />
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{t('profile_move_timer_title')}</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">{t('profile_move_timer_desc')}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMoveTimerMinutes(m => Math.max(1, m - 1))}
          className="w-11 h-11 rounded-2xl bg-secondary border border-white/10 text-white text-xl font-bold hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
        >−</button>
        <div className="flex-1 flex items-center justify-center gap-2 bg-secondary border border-white/10 rounded-2xl py-2.5">
          <span className="text-2xl font-mono font-extrabold text-white tabular-nums">{moveTimerMinutes}</span>
          <span className="text-sm font-bold text-muted-foreground">{t('profile_move_timer_unit')}</span>
        </div>
        <button
          onClick={() => setMoveTimerMinutes(m => Math.min(60, m + 1))}
          className="w-11 h-11 rounded-2xl bg-secondary border border-white/10 text-white text-xl font-bold hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
        >+</button>
      </div>
      {/* Quick presets */}
      <div className="flex gap-2 pt-1">
        {[5, 10, 15, 20, 30].map(min => (
          <button
            key={min}
            onClick={() => setMoveTimerMinutes(min)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              moveTimerMinutes === min
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-secondary border border-white/5 text-muted-foreground hover:border-white/10'
            }`}
          >
            {min}
          </button>
        ))}
      </div>
    </div>
  );

  const goalSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center gap-2">
        <Target size={20} className="text-primary" />
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{t('profile_daily_goal_title')}</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{t('profile_daily_goal_desc')}</p>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">฿</span>
        <input
          type="number" min="0"
          value={dailyGoal}
          onChange={e => setDailyGoal(e.target.value)}
          placeholder={t('profile_daily_goal_placeholder')}
          className="w-full bg-secondary border border-white/10 rounded-2xl pl-8 pr-4 py-3.5 text-white font-mono font-bold text-base outline-none focus:border-primary/50 transition-colors"
        />
      </div>
    </div>
  );

  const languageSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-3 shadow-xl">
      <div className="flex items-center gap-2">
        <Globe size={20} className="text-primary" />
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{t('profile_language_title')}</h3>
      </div>
      <div className="flex bg-secondary/60 p-1 rounded-2xl border border-white/5 gap-1">
        {([
          { value: 'en' as const, label: 'English' },
          { value: 'th' as const, label: 'ภาษาไทย' },
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => setSelectedLang(opt.value)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              selectedLang === opt.value
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm scale-[0.98]'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground text-center px-2">
        {selectedLang === 'en' ? 'Language will change when you save.' : 'ภาษาจะเปลี่ยนเมื่อกด Save'}
      </p>
    </div>
  );

  const intensivesSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift size={20} className="text-primary" />
          <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{t('profile_intensives_title')}</h3>
        </div>
        <button
          onClick={() => { setEditingIntensive(undefined); setShowIntensiveModal(true); }}
          className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors"
        >
          <Plus size={14} /> {t('nav_add')}
        </button>
      </div>
      {intensives.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-3">{t('profile_no_intensives')}</p>
      ) : (
        <div className="space-y-2">
          {intensives.map(inc => {
            const topTier = [...inc.tiers].sort((a, b) => b.trips - a.trips)[0];
            const tierCount = inc.tiers.length;
            return (
              <div key={inc.id} className={`flex items-center gap-3 border rounded-2xl p-4 group transition-all ${
                inc.enabled ? 'bg-secondary/40 border-white/5' : 'bg-white/[0.02] border-white/5 opacity-50'
              }`}>
                <button onClick={() => toggleIntensive(inc.id)}
                  className={`shrink-0 w-10 h-6 rounded-full relative transition-all ${inc.enabled ? 'bg-primary' : 'bg-white/10'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${inc.enabled ? 'left-5' : 'left-1'}`} />
                </button>
                <button className="flex-1 text-left min-w-0" onClick={() => { setEditingIntensive(inc); setShowIntensiveModal(true); }}>
                  <p className={`text-sm font-bold truncate ${inc.enabled ? 'text-white' : 'text-muted-foreground'}`}>{inc.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md text-muted-foreground">
                      {inc.countsFor === 'ride' ? t('profile_intensive_taxi') : inc.countsFor === 'express' ? t('profile_intensive_express') : t('profile_intensive_all')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('profile_intensive_up_to')} ฿{topTier?.bonus ?? 0} · {tierCount} {tierCount > 1 ? t('profile_intensive_tiers') : t('profile_intensive_tier')}
                    </span>
                    {inc.startTime && (
                      <span className="text-[10px] font-mono text-muted-foreground">{inc.startTime}–{inc.endTime}</span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditingIntensive(inc); setShowIntensiveModal(true); }}
                    className="p-2 text-muted-foreground hover:text-white rounded-xl hover:bg-white/10 transition-all">
                    <ChevronRight size={16} />
                  </button>
                  <button onClick={() => setDeleteIntensiveId(inc.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const driveSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center gap-2">
        <Cloud size={20} className="text-primary" />
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{t('profile_gdrive_title')}</h3>
      </div>

      {/* ── Guest mode status ── */}
      {isGuestMode() && !googleConnected && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3.5 bg-warning/8 rounded-2xl border border-warning/20">
            <UserX size={20} className="text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-warning">{t('auth_guest_option')}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t('auth_guest_status_desc')}</p>
            </div>
          </div>
          <button onClick={handleGoogleConnect}
            className="w-full flex items-center justify-center gap-3 bg-white text-black py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-colors">
            <LogIn size={18} /> {t('auth_switch_to_google')}
          </button>
          <div className="flex items-start gap-2 px-1">
            <ShieldAlert size={12} className="text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t('profile_gdrive_legal_prefix')}{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">{t('profile_gdrive_privacy')}</a>
              {' '}{t('profile_gdrive_legal_and')}{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">{t('profile_gdrive_terms')}</a>
            </p>
          </div>
        </div>
      )}

      {/* ── Not logged in (no auth mode) ── */}
      {!isGuestMode() && !googleConnected && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground">{t('profile_gdrive_desc')}</p>
          <button onClick={handleGoogleConnect}
            className="w-full flex items-center justify-center gap-3 bg-white text-black py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-colors">
            <LogIn size={18} /> {t('profile_gdrive_login_btn')}
          </button>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            {t('profile_gdrive_legal_prefix')}{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">{t('profile_gdrive_privacy')}</a>
            {' '}{t('profile_gdrive_legal_and')}{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">{t('profile_gdrive_terms')}</a>
          </p>
        </div>
      )}

      {/* ── Google connected ── */}
      {googleConnected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} className="text-primary" />
              <div>
                <p className="text-sm font-bold text-white">{t('profile_gdrive_connected')}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{t('profile_gdrive_auto_backup')}</p>
              </div>
            </div>
            <button onClick={handleGoogleDisconnect} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
              <LogOut size={18} />
            </button>
          </div>
          {isAutoRestoring && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-primary animate-pulse">
              <Download size={14} className="animate-bounce" /> {t('profile_gdrive_restoring')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleManualSync} disabled={isSyncing || isRestoring || isAutoRestoring}
              className="flex items-center justify-center gap-2 bg-secondary text-white py-3 rounded-2xl font-semibold text-sm border border-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? t('profile_gdrive_backing_up') : t('profile_gdrive_backup_btn')}
            </button>
            <button onClick={handleRestore} disabled={isSyncing || isRestoring || isAutoRestoring}
              className="flex items-center justify-center gap-2 bg-secondary text-white py-3 rounded-2xl font-semibold text-sm border border-primary/20 hover:bg-primary/10 transition-colors disabled:opacity-50">
              <Download size={16} className={isRestoring ? 'animate-bounce' : ''} />
              {isRestoring ? t('profile_gdrive_restoring_btn') : t('profile_gdrive_restore_btn')}
            </button>
          </div>
          {lastSync && (
            <p className="text-center text-[11px] text-muted-foreground font-mono">
              {t('profile_gdrive_last_backup')} {format(new Date(lastSync), 'MMM d, h:mm a')}
            </p>
          )}
          <button onClick={() => setShowClearConfirm(true)} disabled={isSyncing || isRestoring || isAutoRestoring}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-destructive border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors disabled:opacity-50">
            <Trash2 size={15} /> {t('profile_clear_data_btn')}
          </button>
        </div>
      )}
    </div>
  );

  const saveButton = (
    <button
      onClick={handleSave}
      disabled={backingUpAfterSave}
      className={`w-full py-4 rounded-2xl font-extrabold text-base transition-all shadow-lg hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 ${
        savedAndBacked
          ? 'bg-primary/20 text-primary border border-primary/20 shadow-none'
          : saved
            ? 'bg-primary/20 text-primary border border-primary/20 shadow-none'
            : 'bg-gradient-to-r from-primary to-[#00b050] text-white shadow-primary/20'
      }`}
    >
      {backingUpAfterSave
        ? t('profile_gdrive_backing_up')
        : savedAndBacked
          ? t('profile_saved_backed_btn')
          : saved
            ? t('profile_saved_btn')
            : t('profile_save_btn')
      }
    </button>
  );

  const modals = (
    <>
      {showIntensiveModal && (
        <IntensiveModal
          initial={editingIntensive}
          onSave={handleSaveIntensive}
          onClose={() => { setShowIntensiveModal(false); setEditingIntensive(undefined); }}
          t={t}
        />
      )}
      <SweetAlert
        show={!!deleteIntensiveId}
        icon="warning"
        title={t('alert_delete_intensive_title')}
        description={t('alert_delete_intensive_desc')}
        confirmText={t('alert_delete_intensive_confirm')}
        cancelText={t('alert_cancel')}
        onConfirm={() => deleteIntensiveId && handleDeleteIntensive(deleteIntensiveId)}
        onCancel={() => setDeleteIntensiveId(null)}
      />
      <SweetAlert
        show={showClearConfirm}
        icon="error"
        title={t('alert_clear_data_title')}
        description={t('alert_clear_data_desc')}
        confirmText={t('alert_clear_data_confirm')}
        cancelText={t('alert_cancel')}
        onConfirm={handleClearData}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
  );

  return (
    <div className={`p-4 space-y-5 relative animate-in fade-in slide-in-from-bottom-4 duration-500 ${isLandscape ? 'pb-4' : 'pb-24'}`}>
      {isLandscape ? (
        <div className="space-y-4">
          {profileHeader}
          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Left: vehicle + province + shift + timer + goal + language */}
            <div className="space-y-4">
              {driveSection}
              {vehicleSection}
              {provinceSection}
              {shiftSection}
              {timerSection}
              {goalSection}
              {languageSection}
            </div>
            {/* Right: intensives */}
            <div className="space-y-4">
              {intensivesSection}
            </div>
          </div>
          {saveButton}
        </div>
      ) : (
        <div className="space-y-5">
          {profileHeader}
          {driveSection}
          {vehicleSection}
          {provinceSection}
          {shiftSection}
          {timerSection}
          {goalSection}
          {intensivesSection}
          {languageSection}
          {saveButton}
        </div>
      )}
      {modals}
    </div>
  );
}
