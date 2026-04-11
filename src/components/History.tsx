import { useState, useMemo } from 'react';
import { getSessions, saveSessions } from '@/lib/storage';
import { ShiftSession } from '@/lib/types';
import { format, startOfWeek, parseISO } from 'date-fns';
import { Trash2 } from 'lucide-react';

export default function History() {
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ShiftSession[]>(() =>
    getSessions().filter(s => s.endTime)
  );

  const dailyData = useMemo(() => {
    const grouped: Record<string, ShiftSession[]> = {};
    sessions.forEach(s => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const weeklyData = useMemo(() => {
    const weeks: Record<string, ShiftSession[]> = {};
    sessions.forEach(s => {
      const d = parseISO(s.date);
      const ws = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!weeks[ws]) weeks[ws] = [];
      weeks[ws].push(s);
    });
    return Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const calcStats = (ss: ShiftSession[]) => {
    const entries = ss.flatMap(s => s.entries);
    const trips = entries.filter(e => e.type === 'income').length;
    const gross = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + (e.driverNet || 0), 0);
    const tips = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + (e.tip || 0), 0);
    const expenses = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
    return { trips, gross, tips, expenses, net: gross + tips - expenses };
  };

  // Delete all sessions for a given date key
  const deleteGroup = (key: string, groupSessions: ShiftSession[]) => {
    if (!confirm(`Delete all data for this period? This cannot be undone.`)) return;
    const groupIds = new Set(groupSessions.map(s => s.id));
    const allSessions = getSessions(); // includes active sessions
    const updated = allSessions.filter(s => !groupIds.has(s.id));
    saveSessions(updated);
    setSessions(updated.filter(s => s.endTime));
    if (expandedDate === key) setExpandedDate(null);
  };

  // Delete a single entry from a session
  const deleteEntry = (entryId: string) => {
    const allSessions = getSessions();
    const updated = allSessions.map(s => ({
      ...s,
      entries: s.entries.filter(e => e.id !== entryId),
    }));
    saveSessions(updated);
    setSessions(updated.filter(s => s.endTime));
  };

  const exportCSV = () => {
    const entries = sessions.flatMap(s => s.entries.map(e => ({ ...e, date: s.date })));
    const header = 'Date,Type,Amount,Tip,Category,Note\n';
    const rows = entries.map(e =>
      `${e.date},${e.type},${e.amount},${e.tip || 0},${e.expenseCategory || ''},${e.note || ''}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gb-driver-history.csv';
    a.click();
  };

  const data = tab === 'daily' ? dailyData : weeklyData;

  return (
    <div className="pb-28 p-4 space-y-5 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-32 -translate-y-32"></div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">History</h1>
        <button onClick={exportCSV} className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-4 py-2 rounded-xl font-bold transition-colors">
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-white/5">
        {(['daily', 'weekly'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t ? 'bg-primary/20 text-primary shadow-sm scale-[0.98]' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'daily' ? 'Daily' : 'Weekly'}
          </button>
        ))}
      </div>

      {data.map(([key, ss]) => {
        const stats = calcStats(ss);
        const isExpanded = expandedDate === key;
        return (
          <div key={key} className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-xl mb-3">
            {/* Main row */}
            <div className="flex items-center">
              <button
                onClick={() => setExpandedDate(isExpanded ? null : key)}
                className="flex-1 p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              >
                <div>
                  <p className="text-base font-bold text-white">
                    {tab === 'daily' ? format(parseISO(key), 'EEE, MMM d') : `Week of ${format(parseISO(key), 'MMM d')}`}
                  </p>
                  <p className="text-xs font-medium text-primary mt-0.5">{stats.trips} trips</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-extrabold text-primary drop-shadow-sm">฿{stats.net.toFixed(0)}</p>
                  <p className="text-xs font-medium text-muted-foreground">net</p>
                </div>
              </button>
              {/* Delete group button */}
              <button
                onClick={e => { e.stopPropagation(); deleteGroup(key, ss); }}
                className="p-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                title="Delete this period"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Expanded entries */}
            {isExpanded && (
              <div className="border-t border-white/5 p-4 space-y-3 bg-black/20">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <MiniStat label="Gross" value={stats.gross} />
                  <MiniStat label="Tips" value={stats.tips} />
                  <MiniStat label="Expenses" value={stats.expenses} />
                  <MiniStat label="Net" value={stats.net} />
                </div>
                {ss.flatMap(s => s.entries).length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-2">No entries</p>
                )}
                {ss.flatMap(s => s.entries).map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-card border border-white/5 rounded-xl p-3 shadow-inner group">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md ${
                        e.type === 'income' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                      }`}>{e.type === 'income' ? 'IN' : 'EX'}</span>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {e.note || e.expenseCategory || 'Trip'}
                        </span>
                        {e.fuelLiters && e.fuelPrice && (
                          <p className="text-[10px] text-muted-foreground/60 font-mono">
                            {e.fuelLiters}L × ฿{e.fuelPrice.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white">฿{e.amount.toFixed(0)}</span>
                      {/* Delete entry button */}
                      <button
                        onClick={() => deleteEntry(e.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                        title="Delete entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {data.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">No shift history yet</div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-bold text-foreground">฿{value.toFixed(0)}</p>
    </div>
  );
}
