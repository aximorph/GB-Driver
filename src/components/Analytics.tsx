import { useMemo } from 'react';
import { getSessions } from '@/lib/storage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

const GREEN = 'hsl(145, 100%, 45%)';
const YELLOW = 'hsl(54, 100%, 62%)';
const RED = 'hsl(0, 76%, 60%)';
const COLORS = [GREEN, YELLOW, RED];

export default function Analytics() {
  const sessions = getSessions().filter(s => s.endTime);

  const barData = useMemo(() => {
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const date = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
      const daySessions = sessions.filter(s => s.date === date);
      const entries = daySessions.flatMap(s => s.entries);
      const net = entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.driverNet || 0), 0);
      const tips = entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.tip || 0), 0);
      const expenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
      return { date: format(subDays(new Date(), 13 - i), 'MM/dd'), net, tips, expenses };
    });
    return last14;
  }, [sessions]);

  const pieData = useMemo(() => {
    const entries = sessions.flatMap(s => s.entries);
    const income = entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.driverNet || 0) + (e.tip || 0), 0);
    const expenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return [
      { name: 'Income', value: income },
      { name: 'Expenses', value: expenses },
    ];
  }, [sessions]);

  const tipStats = useMemo(() => {
    const incomeEntries = sessions.flatMap(s => s.entries).filter(e => e.type === 'income');
    const totalTips = incomeEntries.reduce((s, e) => s + (e.tip || 0), 0);
    const avgTip = incomeEntries.length > 0 ? totalTips / incomeEntries.length : 0;
    return { avgTip, totalTrips: incomeEntries.length };
  }, [sessions]);

  const fuelData = useMemo(() => {
    const fuelEntries = sessions.flatMap(s =>
      s.entries.filter(e => e.type === 'expense' && (e.expenseCategory?.includes('Fuel') || e.expenseCategory?.includes('Charging')))
        .map(e => ({ date: s.date, amount: e.amount }))
    );
    let cum = 0;
    const sorted = fuelEntries.sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map(e => {
      cum += e.amount;
      return { date: format(parseISO(e.date), 'MM/dd'), total: cum };
    });
  }, [sessions]);

  const heatmapData = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(d => { grid[d] = {}; for (let h = 0; h < 24; h++) grid[d][h] = 0; });
    sessions.forEach(s => {
      s.entries.filter(e => e.type === 'income').forEach(e => {
        const d = new Date(e.timestamp);
        const dayName = days[(d.getDay() + 6) % 7];
        const hour = d.getHours();
        grid[dayName][hour] += (e.driverNet || 0) + (e.tip || 0);
      });
    });
    const maxVal = Math.max(1, ...Object.values(grid).flatMap(h => Object.values(h)));
    return { grid, days, maxVal };
  }, [sessions]);

  return (
    <div className="pb-24 p-4 space-y-5 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 -translate-x-16 -translate-y-16"></div>
      <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">Analytics</h1>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Complete some shifts to see analytics</div>
      ) : (
        <>
          {/* Earnings Bar Chart */}
          <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Last 14 Days Earnings</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215, 16%, 52%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 16%, 52%)' }} width={40} />
                <Tooltip contentStyle={{ background: 'hsl(220, 33%, 7%)', border: '1px solid hsl(220, 20%, 18%)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="net" stackId="a" fill={GREEN} radius={[0, 0, 0, 0]} />
                <Bar dataKey="tips" stackId="a" fill={YELLOW} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly Heatmap — col=day, row=hour */}
          <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Hourly Earnings Heatmap</h3>
            <div className="flex gap-1">
              {/* Hour labels column */}
              <div className="flex flex-col gap-0.5 shrink-0">
                {/* spacer for day header row */}
                <div style={{ height: 20 }} />
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="text-[10px] text-muted-foreground flex items-center justify-end pr-1"
                    style={{ height: 14 }}
                  >
                    {h % 3 === 0 ? `${String(h).padStart(2,'0')}` : ''}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {heatmapData.days.map(d => (
                <div key={d} className="flex flex-col gap-0.5 flex-1">
                  {/* Day header */}
                  <div className="text-[10px] font-bold text-muted-foreground text-center" style={{ height: 20 }}>
                    {d}
                  </div>
                  {/* Hour cells */}
                  {Array.from({ length: 24 }, (_, h) => {
                    const val = heatmapData.grid[d][h];
                    const intensity = val / heatmapData.maxVal;
                    return (
                      <div
                        key={h}
                        className="rounded-sm w-full"
                        style={{
                          height: 14,
                          background: intensity > 0
                            ? `hsla(145, 100%, 45%, ${0.15 + intensity * 0.85})`
                            : 'hsl(220, 20%, 14%)',
                        }}
                        title={`${d} ${String(h).padStart(2,'0')}:00 — ฿${val.toFixed(0)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Income vs Expense Pie */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Income vs Expense</h3>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i === 1 ? 2 : 0]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(220, 33%, 7%)', border: '1px solid hsl(220, 20%, 18%)', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tip Rate</h3>
              <div className="text-center space-y-1 pt-4">
                <p className="font-mono text-2xl font-bold text-warning">฿{tipStats.avgTip.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">avg tip/trip</p>
                <p className="text-xs text-muted-foreground">{tipStats.totalTrips} trips total</p>
              </div>
            </div>
          </div>

          {/* Vehicle Cost Tracker */}
          {fuelData.length > 0 && (
            <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Vehicle Cost Tracker</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={fuelData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215, 16%, 52%)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 16%, 52%)' }} width={40} />
                  <Tooltip contentStyle={{ background: 'hsl(220, 33%, 7%)', border: '1px solid hsl(220, 20%, 18%)', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" stroke={RED} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
