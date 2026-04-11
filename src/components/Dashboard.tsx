import { useState, useEffect, useCallback } from 'react';
import { ShiftSession, Entry, ShiftStatus } from '@/lib/types';
import { getSessions, saveSessions, getActiveSession, getProfile } from '@/lib/storage';
import { format } from 'date-fns';
import { Trash2, DollarSign, Receipt } from 'lucide-react';
import AddEntryModal from './AddEntryModal';
import EndShiftModal from './EndShiftModal';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<ShiftSession[]>(getSessions());
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(getActiveSession());
  const [elapsed, setElapsed] = useState(0);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showEndShift, setShowEndShift] = useState(false);

  const status: ShiftStatus = activeSession ? 'on_shift' : 'offline';
  const profile = getProfile();
  const today = new Date().toISOString().split('T')[0];

  // entries ของ session ที่กำลัง active เท่านั้น — หายเมื่อ end shift
  const activeEntries = activeSession?.entries ?? [];

  // summary ยังคงอิงทั้งวัน (ทุก session ของวันนี้)
  const todayEntries = sessions
    .filter(s => s.date === today)
    .flatMap(s => s.entries);

  const grossEarnings = todayEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + (e.driverNet || 0), 0);
  const totalTips = todayEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + (e.tip || 0), 0);
  const totalExpenses = todayEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const netEarnings = grossEarnings + totalTips - totalExpenses;

  useEffect(() => {
    if (!activeSession) return;
    const start = new Date(activeSession.startTime).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const startShift = () => {
    const session: ShiftSession = {
      id: generateId(),
      date: today,
      startTime: new Date().toISOString(),
      entries: [],
    };
    const updated = [...sessions, session];
    setSessions(updated);
    saveSessions(updated);
    setActiveSession(session);
    window.dispatchEvent(new CustomEvent('gbdriver:session-changed'));
  };

  const addEntry = useCallback((entry: Omit<Entry, 'id' | 'sessionId' | 'timestamp'>) => {
    if (!activeSession) return;
    const newEntry: Entry = {
      ...entry,
      id: generateId(),
      sessionId: activeSession.id,
      timestamp: new Date().toISOString(),
    };
    // functional update — always operates on latest state, no stale closure
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeSession.id ? { ...s, entries: [...s.entries, newEntry] } : s
      );
      saveSessions(updated);
      return updated;
    });
    setActiveSession(prev => prev ? { ...prev, entries: [...prev.entries, newEntry] } : null);
  }, [activeSession]);

  const endShift = useCallback((grabPayout: number) => {
    if (!activeSession) return;
    // functional update — guarantees we get the absolute latest entries
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeSession.id
          ? { ...s, endTime: new Date().toISOString(), grabPayoutAmount: grabPayout }
          : s
      );
      saveSessions(updated);
      return updated;
    });
    setActiveSession(null);
    window.dispatchEvent(new CustomEvent('gbdriver:session-changed'));
  }, [activeSession]);

  const deleteEntry = useCallback((entryId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => ({
        ...s,
        entries: s.entries.filter(e => e.id !== entryId),
      }));
      saveSessions(updated);
      return updated;
    });
    setActiveSession(prev => prev ? { ...prev, entries: prev.entries.filter(e => e.id !== entryId) } : null);
  }, []);

  // Listen for add entry event from BottomNav
  useEffect(() => {
    const handler = () => setShowAddEntry(true);
    window.addEventListener('gbdriver:open-add-entry', handler);
    return () => window.removeEventListener('gbdriver:open-add-entry', handler);
  }, []);

  return (
    <div className="pb-24 space-y-4 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[#00f260] to-primary bg-clip-text text-transparent drop-shadow-sm">GB-Driver</h1>
          <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMM d, yyyy')}</p>
        </div>
      </div>

      {/* Shift Status */}
      <div className="bg-card/80 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-12 -translate-y-12"></div>
        <div className="flex items-center justify-between z-10">
          <span className="text-sm font-medium text-muted-foreground">Shift Status</span>
          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full shadow-inner ${status === 'on_shift' ? 'bg-primary border border-primary/50 text-white' : 'bg-secondary text-muted-foreground'
            }`}>
            {status === 'on_shift' ? 'ON SHIFT' : 'OFFLINE'}
          </span>
        </div>

        {status === 'on_shift' && (
          <div className="text-center py-4">
            <p className="text-4xl font-mono font-extrabold text-white tracking-widest">{formatElapsed(elapsed)}</p>
          </div>
        )}

        {status === 'offline' ? (
          <button
            onClick={startShift}
            className="w-full py-4 mt-2 rounded-xl bg-gradient-to-r from-primary to-[#00b050] shadow-lg shadow-primary/20 text-white font-bold text-sm animate-pulse-glow hover:scale-[1.02] transition-transform"
          >
            START SHIFT
          </button>
        ) : (
          <button
            onClick={() => setShowEndShift(true)}
            className="w-full py-4 mt-2 rounded-xl bg-destructive text-white font-bold text-sm shadow-lg shadow-destructive/20 hover:scale-[1.02] transition-transform"
          >
            END SHIFT
          </button>
        )}
      </div>

      {/* Today's Summary */}
      <div className="bg-card/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex justify-between items-end mb-6">
          <h3 className="text-xs font-black text-muted-foreground tracking-widest uppercase">Summary</h3>
          <p className="text-[10px] font-bold text-primary/80 bg-primary/10 px-2 py-1 rounded-md">{todayEntries.length} entries</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <SummaryItem label="Net Earnings" value={netEarnings} color="text-white text-2xl" />
          <SummaryItem label="Gross" value={grossEarnings} color="text-primary text-xl" />
          <SummaryItem label="Tips" value={totalTips} color="text-warning text-xl" />
          <SummaryItem label="Expenses" value={totalExpenses} color="text-destructive text-xl" />
        </div>
      </div>

      {/* Recent Entries — เฉพาะ active session เท่านั้น หายเมื่อ end shift */}
      {activeEntries.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-black text-muted-foreground px-2 tracking-widest uppercase mt-6 mb-2">Recent Shifts</h3>
          {[...activeEntries].reverse().map(entry => (
            <div key={entry.id} className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex flex-col gap-3 shadow-lg hover:bg-card/90 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${entry.type === 'income' ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-destructive/20 text-destructive border border-destructive/20'
                    }`}>
                    {entry.type === 'income' ? <DollarSign size={20} strokeWidth={2.5} /> : <Receipt size={20} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {entry.type === 'income' ? 'Income' : (entry.expenseCategory || 'Expense')}
                    </h4>
                    <p className="text-xs text-muted-foreground font-medium">
                      {format(new Date(entry.timestamp), 'h:mm a')}
                      {entry.fuelLiters && entry.fuelLiters > 0 && (
                        <span className="ml-1.5 text-primary font-semibold">· {entry.fuelLiters.toFixed(2)} L</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-lg font-extrabold ${entry.type === 'income' ? 'text-white' : 'text-foreground'}`}>
                    ฿{entry.type === 'income' ? ((entry.driverNet || 0) + (entry.tip || 0)).toFixed(0) : entry.amount.toFixed(0)}
                  </p>
                  {entry.tip && entry.tip > 0 && (
                    <p className="text-[10px] text-warning font-bold uppercase mt-0.5">+ ฿{entry.tip.toFixed(0)} tip</p>
                  )}
                  <button onClick={() => deleteEntry(entry.id)} className="mt-2 text-muted-foreground hover:text-destructive transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg flex items-center justify-center ml-auto">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {entry.type === 'income' && entry.appFare && entry.driverNet && (
                <div className="bg-black/20 rounded-xl p-3 flex justify-between items-center border border-white/5 mt-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">App Deduction</span>
                  <span className="text-xs font-mono font-bold text-destructive">
                    ฿{Math.max(0, entry.appFare - entry.driverNet).toFixed(0)} ({entry.appFare > 0 ? ((Math.max(0, entry.appFare - entry.driverNet) / entry.appFare) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddEntry && (
        <AddEntryModal
          onSave={(entry) => { addEntry(entry); setShowAddEntry(false); }}
          onClose={() => setShowAddEntry(false)}
        />
      )}

      {showEndShift && activeSession && (
        <EndShiftModal
          session={activeSession}
          onConfirm={(payout) => { endShift(payout); setShowEndShift(false); }}
          onClose={() => setShowEndShift(false)}
        />
      )}
    </div>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`font-mono font-extrabold ${color}`}>฿{value.toFixed(0)}</p>
    </div>
  );
}
