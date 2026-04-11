import { useState, useEffect } from 'react';
import { DriverProfile } from '@/lib/types';
import { getProfile, saveProfile } from '@/lib/storage';
import { Zap, Fuel, Cloud, CheckCircle2, LogIn, RefreshCw, LogOut, Download } from 'lucide-react';
import { format } from 'date-fns';
import { initGoogleIdentity, requestGoogleLogin, backupDataToDrive, restoreFromDrive, isGoogleConnected, disconnectGoogle } from '@/lib/googleDrive';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ProfilePage() {
  const [profile, setProfile] = useState<DriverProfile | null>(getProfile());
  const [vehicleType, setVehicleType] = useState<'electric' | 'petrol'>(profile?.vehicleType || 'petrol');
  const [fuelType, setFuelType] = useState<DriverProfile['fuelType']>(profile?.fuelType || '95');
  const [schedule, setSchedule] = useState<DriverProfile['schedule']>(
    profile?.schedule || Object.fromEntries(DAYS.map(d => [d, { start: '08:00', end: '20:00', enabled: true }]))
  );
  const [saved, setSaved] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('gdrive_last_sync'));

  const handleSave = () => {
    const updated: DriverProfile = {
      vehicleType,
      fuelType: vehicleType === 'petrol' ? fuelType : undefined,
      commissionRate: profile?.commissionRate || 0.20, // Keep existing rate in storage if any
      schedule,
    };
    saveProfile(updated);
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    initGoogleIdentity();
  }, []);

  const handleGoogleConnect = async () => {
    try {
      await requestGoogleLogin();
      setGoogleConnected(true);
    } catch (err) {
      console.error('Google login failed:', err);
      alert('Failed to connect to Google Drive.');
    }
  };

  const handleGoogleDisconnect = () => {
    disconnectGoogle();
    setGoogleConnected(false);
  };

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
        // Reload profile from storage after restore
        setProfile(getProfile());
        alert('✅ Data restored from Google Drive successfully! The page will reload.');
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

  return (
    <div className="pb-24 p-4 space-y-5 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-16 -translate-y-16"></div>
      <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">Profile</h1>

      {/* Vehicle Type */}
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
              <div className="font-bold text-sm">
                {type === 'electric' ? 'Electric' : 'Petrol/Gas'}
                {type === 'petrol' && vehicleType === 'petrol' && fuelType && (
                  <span className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-md font-mono shadow-sm">
                    {fuelType.toUpperCase()}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Sub-options for Petrol */}
        <div className={`transition-all duration-300 ease-in-out ${vehicleType === 'petrol' ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
           <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/5">
              {(['diesel', '91', '95', 'e20'] as const).map(fuel => (
                <button
                  key={fuel}
                  onClick={() => setFuelType(fuel)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    fuelType === fuel
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-secondary border border-white/5 text-muted-foreground hover:border-white/10'
                  }`}
                >
                  {fuel.toUpperCase()}
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* Google Auto-Backup */}
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
              <LogIn size={18} />
              Login with Google
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
              <button 
                onClick={handleGoogleDisconnect} 
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                title="Disconnect Google Drive"
              >
                <LogOut size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleManualSync}
                disabled={isSyncing || isRestoring}
                className="flex items-center justify-center gap-2 bg-secondary text-white py-3 rounded-2xl font-semibold text-sm border border-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Backing up...' : 'Backup ↑'}
              </button>
              <button
                onClick={handleRestore}
                disabled={isSyncing || isRestoring}
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
          </div>
        )}
      </div>

      {/* Work Schedule */}
      <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase px-1">Work Schedule</h3>
        <div className="space-y-2">
          {DAYS.map(day => (
            <div key={day} className="flex items-center justify-between gap-1.5 sm:gap-3 bg-secondary/30 rounded-2xl p-2 sm:p-3 border border-white/5">
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={schedule[day]?.enabled ?? true}
                  onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], enabled: e.target.checked } }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-white font-semibold w-7 sm:w-10 text-xs sm:text-sm">{day}</span>
              </label>
              <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 justify-end">
                <input
                  type="time"
                  value={schedule[day]?.start || '08:00'}
                  onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], start: e.target.value } }))}
                  disabled={!schedule[day]?.enabled}
                  className="bg-input/50 text-white rounded-lg px-0.5 sm:px-2 py-1 text-xs sm:text-sm font-mono flex-1 min-w-0 text-center disabled:opacity-40 border border-white/5 outline-none focus:border-primary/50"
                />
                <span className="text-muted-foreground text-xs sm:text-sm shrink-0">–</span>
                <input
                  type="time"
                  value={schedule[day]?.end || '20:00'}
                  onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], end: e.target.value } }))}
                  disabled={!schedule[day]?.enabled}
                  className="bg-input/50 text-white rounded-lg px-0.5 sm:px-2 py-1 text-xs sm:text-sm font-mono flex-1 min-w-0 text-center disabled:opacity-40 border border-white/5 outline-none focus:border-primary/50"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className={`w-full py-4 rounded-2xl font-extrabold text-base transition-all shadow-lg hover:scale-[1.02] ${
          saved ? 'bg-primary/20 text-primary border border-primary/20 shadow-none' : 'bg-gradient-to-r from-primary to-[#00b050] text-white shadow-primary/20'
        }`}
      >
        {saved ? '✓ Saved!' : 'Save Changes'}
      </button>
    </div>
  );
}
