import { useState, useMemo } from 'react';
import { getSessions } from '@/lib/storage';
import { ShiftSession } from '@/lib/types';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

export default function History() {
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const sessions = getSessions().filter(s => s.endTime);

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

      {(tab === 'daily' ? dailyData : weeklyData).map(([key, ss]) => {
        const stats = calcStats(ss);
        const isExpanded = expandedDate === key;
        return (
          <div key={key} className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-xl mb-3">
            <button
              onClick={() => setExpandedDate(isExpanded ? null : key)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
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
            {isExpanded && (
              <div className="border-t border-white/5 p-4 space-y-3 bg-black/20">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <MiniStat label="Gross" value={stats.gross} />
                  <MiniStat label="Tips" value={stats.tips} />
                  <MiniStat label="Expenses" value={stats.expenses} />
                  <MiniStat label="Net" value={stats.net} />
                </div>
                {ss.flatMap(s => s.entries).map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-card border border-white/5 rounded-xl p-3 shadow-inner">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md ${
                        e.type === 'income' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                      }`}>{e.type === 'income' ? 'IN' : 'EX'}</span>
                      <span className="text-xs font-medium text-muted-foreground">{e.note || e.expenseCategory || 'Trip'}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-white">฿{e.amount.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {(tab === 'daily' ? dailyData : weeklyData).length === 0 && (
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
