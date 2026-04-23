import { useMemo } from 'react';
import { getSessions } from '@/lib/storage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, parseISO, startOfMonth } from 'date-fns';
import { useT } from '@/context/LangContext';
import { useIsLandscape } from '@/hooks/useIsLandscape';

const GREEN  = 'hsl(145, 100%, 45%)';
const YELLOW = 'hsl(54,  100%, 62%)';
const RED    = 'hsl(0,   76%,  60%)';
const BLUE   = 'hsl(210, 100%, 60%)';
const COLORS = [GREEN, RED];

const TOOLTIP_STYLE = {
  background: 'hsl(220, 33%, 7%)',
  border: '1px solid hsl(220, 20%, 18%)',
  borderRadius: 8,
  fontSize: 12,
};
const TICK = { fontSize: 10, fill: 'hsl(215, 16%, 52%)' };

export default function Analytics() {
  const isLandscape = useIsLandscape();
  const t = useT();
  const sessions = getSessions().filter(s => s.endTime);

  // ── 14-day earnings bar chart ───────────────────────────────────────────────
  const barData = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
      const entries = sessions.filter(s => s.date === date).flatMap(s => s.entries);
      const net  = entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.driverNet || 0), 0);
      const tips = entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.tip || 0), 0);
      return { date: format(subDays(new Date(), 13 - i), 'MM/dd'), net, tips };
    });
  }, [sessions]);

  // ── Hourly heatmap ──────────────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(d => { grid[d] = {}; for (let h = 0; h < 24; h++) grid[d][h] = 0; });
    sessions.forEach(s => {
      s.entries.filter(e => e.type === 'income').forEach(e => {
        const d = new Date(e.timestamp);
        grid[days[(d.getDay() + 6) % 7]][d.getHours()] += (e.driverNet || 0) + (e.tip || 0);
      });
    });
    const maxVal = Math.max(1, ...Object.values(grid).flatMap(h => Object.values(h)));
    return { grid, days, maxVal };
  }, [sessions]);

  // ── Income vs Expense pie ───────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const entries = sessions.flatMap(s => s.entries);
    return [
      { name: t('analytics_income'),   value: entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.driverNet || 0) + (e.tip || 0), 0) },
      { name: t('analytics_expenses'), value: entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0) },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, t]);

  // ── Tip stats ───────────────────────────────────────────────────────────────
  const tipStats = useMemo(() => {
    const inc = sessions.flatMap(s => s.entries).filter(e => e.type === 'income');
    const totalTips = inc.reduce((s, e) => s + (e.tip || 0), 0);
    return { avgTip: inc.length > 0 ? totalTips / inc.length : 0, totalTrips: inc.length };
  }, [sessions]);

  // ── ฿/hr ────────────────────────────────────────────────────────────────────
  const perHourData = useMemo(() => {
    const dailyHr = Array.from({ length: 14 }, (_, i) => {
      const date = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
      const daySess = sessions.filter(s => s.date === date && s.endTime);
      const earnings = daySess.flatMap(s => s.entries)
        .filter(e => e.type === 'income')
        .reduce((sum, e) => sum + (e.driverNet || 0) + (e.tip || 0), 0);
      const hrs = daySess.reduce((sum, s) =>
        sum + (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 3_600_000, 0);
      return { date: format(subDays(new Date(), 13 - i), 'MM/dd'), perHour: hrs > 0 ? earnings / hrs : 0 };
    });

    const totalEarnings = sessions.flatMap(s => s.entries)
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + (e.driverNet || 0) + (e.tip || 0), 0);
    const totalHrs = sessions.reduce((sum, s) =>
      sum + (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 3_600_000, 0);
    const avgPerHour = totalHrs > 0 ? totalEarnings / totalHrs : 0;
    const bestDay = Math.max(0, ...dailyHr.map(d => d.perHour));

    return { dailyHr, avgPerHour, bestDay, totalHrs };
  }, [sessions]);

  // ── Monthly summary ─────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months: Record<string, { gross: number; tips: number; expenses: number; trips: number; hrs: number }> = {};
    sessions.forEach(s => {
      const key = s.date.slice(0, 7);
      if (!months[key]) months[key] = { gross: 0, tips: 0, expenses: 0, trips: 0, hrs: 0 };
      s.entries.forEach(e => {
        if (e.type === 'income') { months[key].gross += e.driverNet || 0; months[key].tips += e.tip || 0; months[key].trips++; }
        else months[key].expenses += e.amount;
      });
      if (s.endTime) months[key].hrs += (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3_600_000;
    });
    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, d]) => ({
        month: format(startOfMonth(parseISO(key + '-01')), 'MMM yy'),
        net: d.gross + d.tips - d.expenses,
        gross: d.gross,
        tips: d.tips,
        expenses: d.expenses,
        trips: d.trips,
        hrs: d.hrs,
      }));
  }, [sessions]);

  // ── App deduction tracker ───────────────────────────────────────────────────
  const deductionData = useMemo(() => {
    const inc = sessions.flatMap(s => s.entries).filter(e => e.type === 'income' && e.appFare && e.driverNet);
    if (inc.length === 0) return null;

    const calc = (entries: typeof inc) => {
      const fare = entries.reduce((s, e) => s + (e.appFare || 0), 0);
      const deducted = entries.reduce((s, e) => s + Math.max(0, (e.appFare || 0) - (e.driverNet || 0)), 0);
      return { fare, deducted, pct: fare > 0 ? (deducted / fare) * 100 : 0 };
    };

    const all  = calc(inc);
    const grab = calc(inc.filter(e => e.platform !== 'bolt'));
    const bolt = calc(inc.filter(e => e.platform === 'bolt'));

    return { all, grab, bolt };
  }, [sessions]);

  return (
    <div className={`p-4 space-y-5 relative animate-in fade-in slide-in-from-bottom-4 duration-500 ${isLandscape ? 'pb-4' : 'pb-24'}`}>
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 -translate-x-16 -translate-y-16" />
      <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">{t('analytics_title')}</h1>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{t('analytics_no_data')}</div>
      ) : (
        <>
          {/* ── 14-day Earnings Bar Chart ──────────────────────────────────── */}
          <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('analytics_14_days')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <XAxis dataKey="date" tick={TICK} />
                <YAxis tick={TICK} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="net"  stackId="a" fill={GREEN}  radius={[0,0,0,0]} />
                <Bar dataKey="tips" stackId="a" fill={YELLOW} radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Heatmap ───────────────────────────────────────────────────── */}
          <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('analytics_heatmap')}</h3>
            <div className="flex gap-1">
              <div className="flex flex-col gap-0.5 shrink-0">
                <div style={{ height: 20 }} />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-[10px] text-muted-foreground flex items-center justify-end pr-1" style={{ height: 14 }}>
                    {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                  </div>
                ))}
              </div>
              {heatmapData.days.map(d => (
                <div key={d} className="flex flex-col gap-0.5 flex-1">
                  <div className="text-[10px] font-bold text-muted-foreground text-center" style={{ height: 20 }}>{d}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const val = heatmapData.grid[d][h];
                    const intensity = val / heatmapData.maxVal;
                    return (
                      <div key={h} className="rounded-sm w-full" style={{ height: 14, background: intensity > 0 ? `hsla(145,100%,45%,${0.15 + intensity * 0.85})` : 'hsl(220,20%,14%)' }}
                        title={`${d} ${String(h).padStart(2,'0')}:00 — ฿${val.toFixed(0)}`} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ── Pie + Tip Rate ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('analytics_pie')}</h3>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ ...TOOLTIP_STYLE, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('analytics_tip_rate')}</h3>
              <div className="text-center space-y-1 pt-4">
                <p className="font-mono text-2xl font-bold text-warning">฿{tipStats.avgTip.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{t('analytics_avg_tip')}</p>
                <p className="text-xs text-muted-foreground">{tipStats.totalTrips} {t('analytics_trips_total')}</p>
              </div>
            </div>
          </div>

          {/* ── ฿/hr ─────────────────────────────────────────────────────── */}
          <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">{t('analytics_per_hour')}</h3>
            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label={t('analytics_avg_per_hour')}
                value={`฿${perHourData.avgPerHour.toFixed(0)}`}
                color="text-primary"
                big
              />
              <StatCard
                label={t('analytics_best_day_hr')}
                value={`฿${perHourData.bestDay.toFixed(0)}`}
                color="text-warning"
              />
              <StatCard
                label={t('analytics_total_hours')}
                value={`${perHourData.totalHrs.toFixed(1)}`}
                color="text-muted-foreground"
              />
            </div>
            {/* Daily bar chart */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">{t('analytics_daily_hr_chart')}</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={perHourData.dailyHr}>
                  <XAxis dataKey="date" tick={TICK} />
                  <YAxis tick={TICK} width={40} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`฿${v.toFixed(0)}/hr`, '']} />
                  <Bar dataKey="perHour" fill={BLUE} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Monthly Summary ───────────────────────────────────────────── */}
          {monthlyData.length > 0 && (
            <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('analytics_monthly')}</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" tick={TICK} />
                  <YAxis tick={TICK} width={40} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="gross" stackId="a" fill={GREEN}  radius={[0,0,0,0]} name={t('analytics_income')} />
                  <Bar dataKey="tips"  stackId="a" fill={YELLOW} radius={[0,0,0,0]} name="Tips" />
                  <Bar dataKey="expenses" fill={RED} radius={[3,3,0,0]} name={t('analytics_expenses')} />
                </BarChart>
              </ResponsiveContainer>
              {/* Last month detail */}
              {monthlyData.length > 0 && (() => {
                const last = monthlyData[monthlyData.length - 1];
                return (
                  <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/5">
                    <StatCard label={last.month} value={`฿${last.net.toFixed(0)}`} color="text-primary" />
                    <StatCard label={t('analytics_trips_label')} value={String(last.trips)} color="text-white" />
                    <StatCard label={t('analytics_hrs_label')} value={last.hrs.toFixed(1)} color="text-muted-foreground" />
                    <StatCard label="฿/hr" value={`฿${last.hrs > 0 ? (last.gross + last.tips) / last.hrs : 0 | 0}`} color="text-blue-400" />
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── App Deduction Tracker ─────────────────────────────────────── */}
          <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">{t('analytics_deduction')}</h3>
            {!deductionData ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('analytics_no_deduction_data')}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label={t('analytics_total_deducted')}
                    value={`฿${deductionData.all.deducted.toFixed(0)}`}
                    color="text-destructive"
                    big
                  />
                  <StatCard
                    label="Grab"
                    value={`${deductionData.grab.pct.toFixed(1)}%`}
                    color="text-primary"
                    sub={`฿${deductionData.grab.deducted.toFixed(0)}`}
                  />
                  <StatCard
                    label="Bolt"
                    value={deductionData.bolt.fare > 0 ? `${deductionData.bolt.pct.toFixed(1)}%` : '—'}
                    color="text-yellow-400"
                    sub={deductionData.bolt.fare > 0 ? `฿${deductionData.bolt.deducted.toFixed(0)}` : ''}
                  />
                </div>
                {/* Overall rate bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{t('analytics_avg_deduction_rate')}</span>
                    <span className="font-mono font-bold text-destructive">{deductionData.all.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-destructive/70 transition-all duration-700"
                      style={{ width: `${Math.min(deductionData.all.pct * 3, 100)}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color, big, sub }: {
  label: string;
  value: string;
  color: string;
  big?: boolean;
  sub?: string;
}) {
  return (
    <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-center space-y-0.5">
      <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
      <p className={`font-mono font-bold ${big ? 'text-lg' : 'text-sm'} ${color}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground font-mono">{sub}</p>}
    </div>
  );
}
