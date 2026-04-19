import { useState, useEffect } from 'react';
import { DriverProfile, Incentive, IncentiveTier } from '@/lib/types';
import { getProfile, saveProfile, saveSessions } from '@/lib/storage';
import { Zap, Fuel, Cloud, CheckCircle2, LogIn, RefreshCw, LogOut, Download, Trash2, Plus, Target, Gift, X, GripVertical, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { initGoogleIdentity, requestGoogleLogin, backupDataToDrive, restoreFromDrive, isGoogleConnected, disconnectGoogle } from '@/lib/googleDrive';
import SweetAlert from '@/components/SweetAlert';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Incentive Modal ──────────────────────────────────────────────────────────
interface IncentiveModalProps {
  initial?: Incentive;
  onSave: (incentive: Incentive) => void;
  onClose: () => void;
}

function IncentiveModal({ initial, onSave, onClose }: IncentiveModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [tiers, setTiers] = useState<IncentiveTier[]>(
    initial?.tiers ?? [{ trips: 0, bonus: 0 }]
  );

  const addTier = () => setTiers(t => [...t, { trips: 0, bonus: 0 }]);
  const removeTier = (i: number) => setTiers(t => t.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: keyof IncentiveTier, val: string) => {
    setTiers(t => t.map((tier, idx) =>
      idx === i ? { ...tier, [field]: parseFloat(val) || 0 } : tier
    ));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const sorted = [...tiers].sort((a, b) => a.trips - b.trips);
    onSave({ id: initial?.id ?? generateId(), name: name.trim(), tiers: sorted });
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
            {initial ? 'Edit Incentive' : 'New Incentive'}
          </h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-white rounded-xl hover:bg-white/10 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Incentive Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Monday Peak, Weekend Special"
            className="w-full bg-secondary border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Tiers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Reward Tiers</label>
            <button
              onClick={addTier}
              className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Plus size={13} /> Add Tier
            </button>
          </div>

          {/* Column labels */}
          <div className="grid grid-cols-[1fr_1fr_32px] gap-2 px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Trips</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Bonus (฿)</span>
            <span />
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
            {tiers.map((tier, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  value={tier.trips || ''}
                  onChange={e => updateTier(i, 'trips', e.target.value)}
                  placeholder="5"
                  className="bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white text-center outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  type="number"
                  min="0"
                  value={tier.bonus || ''}
                  onChange={e => updateTier(i, 'bonus', e.target.value)}
                  placeholder="30"
                  className="bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white text-center outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={() => removeTier(i)}
                  disabled={tiers.length === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-20"
                >
                  <X size={15} />
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
          Save Incentive
        </button>
      </div>
    </div>
  );
}

// ─── Main ProfilePage ─────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [profile, setProfile] = useState<DriverProfile | null>(getProfile());
  const [vehicleType, setVehicleType] = useState<'electric' | 'petrol'>(profile?.vehicleType || 'petrol');
  const [fuelType, setFuelType] = useState<DriverProfile['fuelType']>(profile?.fuelType || '95');
  const [chargingType, setChargingType] = useState<'home' | 'public'>(profile?.chargingType || 'home');
  const [dailyGoal, setDailyGoal] = useState<string>(profile?.dailyGoal ? String(profile.dailyGoal) : '');
  const [incentives, setIncentives] = useState<Incentive[]>(profile?.incentives ?? []);

  const [saved, setSaved] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isAutoRestoring, setIsAutoRestoring] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('gdrive_last_sync'));
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [editingIncentive, setEditingIncentive] = useState<Incentive | undefined>(undefined);
  const [deleteIncentiveId, setDeleteIncentiveId] = useState<string | null>(null);

  useEffect(() => { initGoogleIdentity(); }, []);

  const handleSave = () => {
    const updated: DriverProfile = {
      vehicleType,
      fuelType: vehicleType === 'petrol' ? fuelType : undefined,
      chargingType: vehicleType === 'electric' ? chargingType : undefined,
      commissionRate: profile?.commissionRate || 0.20,
      dailyGoal: dailyGoal ? parseFloat(dailyGoal) : undefined,
      incentives,
    };
    saveProfile(updated);
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Google Drive handlers ──────────────────────────────────────────────────
  const handleGoogleConnect = async () => {
    try {
      await requestGoogleLogin();
      setGoogleConnected(true);
      setIsAutoRestoring(true);
      try {
        const found = await restoreFromDrive();
        if (found) {
          setProfile(getProfile());
          setTimeout(() => window.location.reload(), 800);
        }
      } catch (err) {
        console.warn('Auto-restore failed:', err);
      } finally {
        setIsAutoRestoring(false);
      }
    } catch (err) {
      console.error('Google login failed:', err);
      alert('Failed to connect to Google Drive.');
    }
  };

  const handleGoogleDisconnect = () => { disconnectGoogle(); setGoogleConnected(false); };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await backupDataToDrive();
      const syncTime = new Date().toISOString();
      setLastSync(syncTime);
      localStorage.setItem('gdrive_last_sync', syncTime);
    } catch (err) {
      console.error('Backup failed:', err);
      alert('Failed to backup to Google Drive.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('This will overwrite your current local data with the backup from Google Drive. Continue?')) return;
    setIsRestoring(true);
    try {
      const found = await restoreFromDrive();
      if (found) {
        setProfile(getProfile());
        alert('✅ Data restored successfully! The page will reload.');
        window.location.reload();
      } else {
        alert('No backup file found on Google Drive.');
      }
    } catch (err) {
      console.error('Restore failed:', err);
      alert('Failed to restore from Google Drive.');
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

  // ── Incentive handlers ─────────────────────────────────────────────────────
  const handleSaveIncentive = (incentive: Incentive) => {
    setIncentives(prev => {
      const exists = prev.find(i => i.id === incentive.id);
      return exists ? prev.map(i => i.id === incentive.id ? incentive : i) : [...prev, incentive];
    });
    setShowIncentiveModal(false);
    setEditingIncentive(undefined);
  };

  const handleDeleteIncentive = (id: string) => {
    setIncentives(prev => prev.filter(i => i.id !== id));
    setDeleteIncentiveId(null);
  };

  return (
    <div className="pb-24 p-4 space-y-5 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-16 -translate-y-16" />
      <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">Profile</h1>

      {/* ── Vehicle Type ──────────────────────────────────────────────────── */}
      <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-3 shadow-xl">
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase px-1">Vehicle Type</h3>
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
              <span className="font-bold text-sm">{type === 'electric' ? 'Electric' : 'Petrol/Gas'}</span>
            </button>
          ))}
        </div>

        <div className={`transition-all duration-300 ease-in-out ${vehicleType === 'petrol' ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/5">
            {(['diesel', '91', '95', 'e20'] as const).map(fuel => (
              <button
                key={fuel}
                onClick={() => setFuelType(fuel)}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  fuelType === fuel ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary border border-white/5 text-muted-foreground hover:border-white/10'
                }`}
              >
                {fuel.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className={`transition-all duration-300 ease-in-out ${vehicleType === 'electric' ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
            {([{ value: 'home', label: 'Home Charging' }, { value: 'public', label: 'Public Charging' }] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setChargingType(opt.value)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                  chargingType === opt.value ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary border border-white/5 text-muted-foreground hover:border-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Daily Earnings Goal ───────────────────────────────────────────── */}
      <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-primary" />
          <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">Daily Earnings Goal</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Set a net earnings target per day. Progress will be shown on your Dashboard.</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">฿</span>
          <input
            type="number"
            min="0"
            value={dailyGoal}
            onChange={e => setDailyGoal(e.target.value)}
            placeholder="1,200"
            className="w-full bg-secondary border border-white/10 rounded-2xl pl-8 pr-4 py-3.5 text-white font-mono font-bold text-base outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* ── Incentives ────────────────────────────────────────────────────── */}
      <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift size={20} className="text-primary" />
            <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">Incentives</h3>
          </div>
          <button
            onClick={() => { setEditingIncentive(undefined); setShowIncentiveModal(true); }}
            className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {incentives.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">No incentives yet. Tap + to add one.</p>
        ) : (
          <div className="space-y-2">
            {incentives.map(inc => {
              const topTier = [...inc.tiers].sort((a, b) => b.trips - a.trips)[0];
              return (
                <div
                  key={inc.id}
                  className="flex items-center justify-between bg-secondary/40 border border-white/5 rounded-2xl p-4 group"
                >
                  <button
                    className="flex-1 text-left"
                    onClick={() => { setEditingIncentive(inc); setShowIncentiveModal(true); }}
                  >
                    <p className="text-sm font-bold text-white">{inc.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {inc.tiers.length} tier{inc.tiers.length > 1 ? 's' : ''} · up to ฿{topTier?.bonus ?? 0} at {topTier?.trips ?? 0} trips
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingIncentive(inc); setShowIncentiveModal(true); }}
                      className="p-2 text-muted-foreground hover:text-white rounded-xl hover:bg-white/10 transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteIncentiveId(inc.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Google Drive Backup ───────────────────────────────────────────── */}
      <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Cloud size={20} className="text-primary" />
          <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">Google Drive Backup</h3>
        </div>

        {!googleConnected ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground">Log in with your Google account to automatically backup your shift history and profile to Google Drive.</p>
            <button
              onClick={handleGoogleConnect}
              className="w-full flex items-center justify-center gap-3 bg-white text-black py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-colors"
            >
              <LogIn size={18} /> Login with Google
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-primary" />
                <div>
                  <p className="text-sm font-bold text-white">Connected</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Auto-backup enabled</p>
                </div>
              </div>
              <button onClick={handleGoogleDisconnect} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                <LogOut size={18} />
              </button>
            </div>
            {isAutoRestoring && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-primary animate-pulse">
                <Download size={14} className="animate-bounce" /> Restoring your data from Drive…
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleManualSync}
                disabled={isSyncing || isRestoring || isAutoRestoring}
                className="flex items-center justify-center gap-2 bg-secondary text-white py-3 rounded-2xl font-semibold text-sm border border-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Backing up...' : 'Backup ↑'}
              </button>
              <button
                onClick={handleRestore}
                disabled={isSyncing || isRestoring || isAutoRestoring}
                className="flex items-center justify-center gap-2 bg-secondary text-white py-3 rounded-2xl font-semibold text-sm border border-primary/20 hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                <Download size={16} className={isRestoring ? 'animate-bounce' : ''} />
                {isRestoring ? 'Restoring...' : 'Restore ↓'}
              </button>
            </div>
            {lastSync && (
              <p className="text-center text-[11px] text-muted-foreground font-mono">
                Last backup: {format(new Date(lastSync), 'MMM d, h:mm a')}
              </p>
            )}
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={isSyncing || isRestoring || isAutoRestoring}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-destructive border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} /> Clear All Local Data
            </button>
          </div>
        )}
      </div>

      {/* ── Save ──────────────────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        className={`w-full py-4 rounded-2xl font-extrabold text-base transition-all shadow-lg hover:scale-[1.02] ${
          saved ? 'bg-primary/20 text-primary border border-primary/20 shadow-none' : 'bg-gradient-to-r from-primary to-[#00b050] text-white shadow-primary/20'
        }`}
      >
        {saved ? '✓ Saved!' : 'Save Changes'}
      </button>

      {/* ── Modals / Alerts ───────────────────────────────────────────────── */}
      {showIncentiveModal && (
        <IncentiveModal
          initial={editingIncentive}
          onSave={handleSaveIncentive}
          onClose={() => { setShowIncentiveModal(false); setEditingIncentive(undefined); }}
        />
      )}

      <SweetAlert
        show={!!deleteIncentiveId}
        icon="warning"
        title="Delete Incentive?"
        description="This incentive will be removed. Make sure to save your profile after."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => deleteIncentiveId && handleDeleteIncentive(deleteIncentiveId)}
        onCancel={() => setDeleteIncentiveId(null)}
      />

      <SweetAlert
        show={showClearConfirm}
        icon="error"
        title="Clear All Data?"
        description="This will permanently delete all shift sessions and history from this device. Your Google Drive backup (if any) will not be affected."
        confirmText="Yes, Clear"
        cancelText="Cancel"
        onConfirm={handleClearData}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
