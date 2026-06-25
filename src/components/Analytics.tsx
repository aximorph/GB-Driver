import { useMemo, useState } from 'react';
import { getSessions } from '@/lib/storage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { format, subDays } from 'date-fns';
import { useT } from '@/context/LangContext';
import { useIsLandscape } from '@/hooks/useIsLandscape';
import SmartCalendarCard from '@/components/SmartCalendarCard';
import FuelPriceHistoryCard from '@/components/FuelPriceHistoryCard';

const GREEN  = 'hsl(145, 100%, 45%)';
const YELLOW = 'hsl(54,  100%, 62%)';
const RED    = 'hsl(0,   76%,  60%)';
const BLUE   = 'hsl(210, 100%, 60%)';
const TOOLTIP_STYLE = {
  background: 'hsl(220, 33%, 7%)',
  border: '1px solid hsl(220, 20%, 18%)',
  borderRadius: 8,
  fontSize: 12,
};
const TICK = { fontSize: 10, fill: 'hsl(215, 16%, 52%)' };

type DurationFilter = 'all' | 'month' | 'week';

export default function Analytics() {
  const isLandscape = useIsLandscape();
  const t = useT();
  const sessions = getSessions().filter(s => s.endTime);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');

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

  // ── Earnings breakdown pie: profit / commission / fuel / other expenses ────
  // Base = total revenue (driverNet + commission + tip), split into 4
  // mutually-exclusive slices that sum back to exactly 100% of it:
  //   profit + commission + fuel + other === revenue
  // (Previously this showed take-home pay as one slice and then tacked fuel
  // /other expenses on top as extra slices, so the pie's total exceeded
  // actual revenue and the percentages didn't mean "share of 100%".)
  const pieData = useMemo(() => {
    const entries = sessions.flatMap(s => s.entries);
    const income = entries.filter(e => e.type === 'income');
    const expenses = entries.filter(e => e.type === 'expense');

    const netIncome  = income.reduce((s, e) => s + (e.driverNet || 0) + (e.tip || 0), 0);
    const commission = income.reduce((s, e) => s + Math.max(0, (e.appFare || 0) - (e.driverNet || 0)), 0);
    const fuelCost    = expenses.filter(e => e.expenseCategory === 'Fuel').reduce((s, e) => s + e.amount, 0);
    const otherExpenses = expenses.filter(e => e.expenseCategory !== 'Fuel').reduce((s, e) => s + e.amount, 0);
    const profit = netIncome - fuelCost - otherExpenses;

    return [
      { name: t('analytics_income'),     value: profit,        color: GREEN },
      { name: t('analytics_commission'), value: commission,    color: YELLOW },
      { name: t('analytics_fuel_cost'),  value: fuelCost,      color: BLUE },
      { name: t('analytics_expenses'),   value: otherExpenses, color: RED },
    ].filter(d => d.value > 0);
  }, [sessions, t]);

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

  // ── Trip duration chart ─────────────────────────────────────────────────────
  const tripDurationData = useMemo(() => {
    const now = new Date();
    // All income entries that have timer data (any period)
    const allWithTimer = sessions
      .flatMap(s => s.entries)
      .filter(e => e.type === 'income' && e.tripDuration && e.tripDuration > 0);

    const hasAnyTimerData = allWithTimer.length > 0;

    let entries = allWithTimer;
    if (durationFilter === 'week') {
      const cutoff = subDays(now, 7).getTime();
      entries = entries.filter(e => new Date(e.tripStartTime ?? e.timestamp).getTime() >= cutoff);
    } else if (durationFilter === 'month') {
      const cutoff = subDays(now, 30).getTime();
      entries = entries.filter(e => new Date(e.tripStartTime ?? e.timestamp).getTime() >= cutoff);
    }

    entries.sort((a, b) =>
      new Date(a.tripStartTime ?? a.timestamp).getTime() -
      new Date(b.tripStartTime ?? b.timestamp).getTime()
    );

    const data = entries.map((e, i) => ({
      index: i + 1,
      minutes: Math.round((e.tripDuration! / 60) * 10) / 10,
      label: format(new Date(e.tripStartTime ?? e.timestamp), 'MM/dd HH:mm'),
      net: e.driverNet ?? 0,
    }));

    const avg = data.length > 0
      ? Math.round((data.reduce((s, d) => s + d.minutes, 0) / data.length) * 10) / 10
      : 0;

    return { data, avg, hasAnyTimerData };
  }, [sessions, durationFilter]);

  // ── App deduction tracker ───────────────────────────────────────────────────
  const deductionData = useMemo(() => {
    const inc = sessions.flatMap(s => s.entries).filter(e => e.type === 'income' && e.appFare && e.driverNet);
    if (inc.length === 0) return null;

    const calc = (entries: typeof inc) => {
      const fare = entries.reduce((s, e) => s + (e.appFare || 0), 0);
      const deducted = entries.reduce((s, e) => s + Math.max(0, (e.appFare || 0) - (e.driverNet || 0)), 0);
      return { fare, deducted, pct: fare > 0 ? (deducted / fare) * 100 : 0, trips: entries.length };
    };

    const all  = calc(inc);
    const grab = calc(inc.filter(e => e.platform !== 'bolt' && e.platform !== 'vip' && e.platform !== 'etc'));
    const bolt = calc(inc.filter(e => e.platform === 'bolt'));

    return { all, grab, bolt };
  }, [sessions]);

  // ── Section variables ───────────────────────────────────────────────────────
  const calendarSection = <SmartCalendarCard />;
  const fuelHistorySection = <FuelPriceHistoryCard />;

  const header = (
    <>
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 -translate-x-16 -translate-y-16" />
      <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">{t('analytics_title')}</h1>
    </>
  );

  const barChartSection = (
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
  );

  const heatmapSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('analytics_heatmap')}</h3>
      <div className="flex gap-1">
        <div className="flex flex-col gap-0.5 shrink-0">
          <div style={{ height: 20 }} />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[10px] text-muted-foreground flex items-center justify-end pr-1" style={{ height: 14 }}>
              {h % 3 === 0 ? String(h).padStart(2, '00') : ''}
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
  );

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const earningsBreakdownSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('analytics_pie')}</h3>
      {pieData.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">{t('analytics_no_data')}</div>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={120} height={120} className="flex-shrink-0">
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={32}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ ...TOOLTIP_STYLE, fontSize: 11 }} formatter={(v: number) => `฿${v.toFixed(0)}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs pb-2 mb-1 border-b border-white/10">
              <span className="font-semibold text-foreground truncate">{t('analytics_total_revenue')}</span>
              <span className="font-mono font-extrabold text-white flex-shrink-0">
                ฿{pieTotal.toFixed(0)}
                <span className="text-muted-foreground font-normal ml-1">100%</span>
              </span>
            </div>
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="font-mono font-semibold text-white flex-shrink-0">
                  ฿{d.value.toFixed(0)}
                  <span className="text-muted-foreground font-normal ml-1">
                    {pieTotal > 0 ? Math.round((d.value / pieTotal) * 100) : 0}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const perHourSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">{t('analytics_per_hour')}</h3>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t('analytics_avg_per_hour')} value={`฿${perHourData.avgPerHour.toFixed(0)}`} color="text-primary" big />
        <StatCard label={t('analytics_best_day_hr')} value={`฿${perHourData.bestDay.toFixed(0)}`} color="text-warning" />
        <StatCard label={t('analytics_total_hours')} value={`${perHourData.totalHrs.toFixed(1)}`} color="text-muted-foreground" />
      </div>
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
  );

  const FILTER_OPTS: { value: DurationFilter; label: string }[] = [
    { value: 'all',   label: t('analytics_duration_all') },
    { value: 'month', label: t('analytics_duration_month') },
    { value: 'week',  label: t('analytics_duration_week') },
  ];

  const tripDurationSection = (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
      {/* Header + filter toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('analytics_trip_duration')}</h3>
        <div className="flex bg-secondary/60 p-0.5 rounded-xl border border-white/5 gap-0.5">
          {FILTER_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDurationFilter(opt.value)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                durationFilter === opt.value
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {tripDurationData.data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          {tripDurationData.hasAnyTimerData
            ? t('analytics_duration_no_data')
            : t('analytics_duration_no_timer_data')}
        </p>
      ) : (
        <>
          {/* Avg stat */}
          <div className="flex items-center gap-3">
            <div className="h-0.5 flex-1 bg-white/5 rounded-full" />
            <span className="text-[11px] text-muted-foreground font-mono">
              {t('analytics_duration_avg')} <span className="text-primary font-bold">{tripDurationData.avg} {t('analytics_duration_min')}</span>
            </span>
            <div className="h-0.5 flex-1 bg-white/5 rounded-full" />
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tripDurationData.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="index"
                tick={TICK}
                tickFormatter={v => (tripDurationData.data.length <= 20 || v % Math.ceil(tripDurationData.data.length / 10) === 0 ? String(v) : '')}
                label={{ value: t('analytics_duration_trip_no'), position: 'insideBottom', offset: -2, style: { fontSize: 9, fill: 'hsl(215,16%,40%)' } }}
              />
              <YAxis tick={TICK} width={36} unit=" m" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => [`${v} min`, t('analytics_duration_label')]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
              />
              <ReferenceLine
                y={tripDurationData.avg}
                stroke={BLUE}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: `avg ${tripDurationData.avg}m`, position: 'insideTopRight', style: { fontSize: 9, fill: BLUE } }}
              />
              <Bar dataKey="minutes" fill={GREEN} radius={[3,3,0,0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground text-center">{tripDurationData.data.length} {t('analytics_duration_trips_shown')}</p>
        </>
      )}
    </div>
  );

  const deductionSection = (() => {
    // Grab vs Bolt comparison logic (computed outside JSX for clarity)
    const hasBolt  = (deductionData?.bolt.trips ?? 0) > 0;
    const hasGrab  = (deductionData?.grab.trips ?? 0) > 0;
    const canCompare = hasBolt && hasGrab;
    const enoughBolt = (deductionData?.bolt.trips ?? 0) >= 3;

    // For bar widths: scale relative to the higher of the two
    const maxPct = deductionData
      ? Math.max(deductionData.grab.pct, deductionData.bolt.pct, 0.1)
      : 1;
    const grabBarW = deductionData ? (deductionData.grab.pct / maxPct) * 100 : 0;
    const boltBarW = deductionData ? (deductionData.bolt.pct / maxPct) * 100 : 0;

    const diff = deductionData ? Math.abs(deductionData.grab.pct - deductionData.bolt.pct) : 0;
    const grabHigher = deductionData ? deductionData.grab.pct > deductionData.bolt.pct : false;

    return (
      <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('analytics_deduction')}</h3>

        {!deductionData ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t('analytics_no_deduction_data')}</p>
        ) : (
          <>
            {/* ── 3 summary sub-cards ── */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label={t('analytics_total_deducted')} value={`฿${deductionData.all.deducted.toFixed(0)}`} color="text-destructive" big />
              <StatCard label="Grab" value={`${deductionData.grab.pct.toFixed(1)}%`} color="text-primary" sub={`฿${deductionData.grab.deducted.toFixed(0)}`} />
              <StatCard label="Bolt" value={hasBolt ? `${deductionData.bolt.pct.toFixed(1)}%` : '—'} color="text-violet-400" sub={hasBolt ? `฿${deductionData.bolt.deducted.toFixed(0)}` : ''} />
            </div>

            {/* ── Grab vs Bolt visual comparison ── */}
            <div className="space-y-2 pt-1 border-t border-white/5">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                {t('analytics_platform_compare')}
              </p>

              {/* Grab bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                    Grab
                    {canCompare && grabHigher && (
                      <span className="text-[9px] font-black bg-primary/15 border border-primary/30 text-primary px-1.5 py-0.5 rounded-md">
                        {t('analytics_higher_platform')}
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {deductionData.grab.pct.toFixed(1)}%
                    <span className="text-muted-foreground font-normal ml-1.5">· {deductionData.grab.trips} {t('analytics_trips_label')}</span>
                  </span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${grabBarW}%` }}
                  />
                </div>
              </div>

              {/* Bolt bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-violet-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                    Bolt
                    {canCompare && !grabHigher && (
                      <span className="text-[9px] font-black bg-violet-500/15 border border-violet-500/30 text-violet-400 px-1.5 py-0.5 rounded-md">
                        {t('analytics_higher_platform')}
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-violet-400">
                    {hasBolt ? `${deductionData.bolt.pct.toFixed(1)}%` : '—'}
                    {hasBolt && <span className="text-muted-foreground font-normal ml-1.5">· {deductionData.bolt.trips} {t('analytics_trips_label')}</span>}
                  </span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  {hasBolt && (
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-700"
                      style={{ width: `${boltBarW}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Verdict */}
              {canCompare && enoughBolt ? (
                <p className="text-[11px] text-center pt-1 font-bold" style={{ color: grabHigher ? 'hsl(145,100%,45%)' : 'hsl(265,80%,75%)' }}>
                  {grabHigher ? 'Grab' : 'Bolt'} {t('analytics_deducts_more_than')} {grabHigher ? 'Bolt' : 'Grab'} {diff.toFixed(1)}%
                </p>
              ) : hasBolt && !enoughBolt ? (
                <p className="text-[10px] text-muted-foreground text-center pt-1">{t('analytics_bolt_low_data')}</p>
              ) : !hasBolt ? (
                <p className="text-[10px] text-muted-foreground text-center pt-1">{t('analytics_no_bolt_data')}</p>
              ) : null}
            </div>
          </>
        )}
      </div>
    );
  })();

  return (
    <div className={`p-4 space-y-5 relative animate-in fade-in slide-in-from-bottom-4 duration-500 ${isLandscape ? 'pb-4' : 'pb-24'}`}>
      {sessions.length === 0 ? (
        <>
          {header}
          <div className="text-center py-12 text-muted-foreground text-sm">{t('analytics_no_data')}</div>
        </>
      ) : isLandscape ? (
        <div className="space-y-4">
          {header}
          {calendarSection}
          {fuelHistorySection}
          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Left: charts over time */}
            <div className="space-y-4">
              {barChartSection}
              {heatmapSection}
            </div>
            {/* Right: breakdowns */}
            <div className="space-y-4">
              {earningsBreakdownSection}
              {perHourSection}
              {tripDurationSection}
              {deductionSection}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {header}
          {calendarSection}
          {fuelHistorySection}
          {barChartSection}
          {heatmapSection}
          {earningsBreakdownSection}
          {perHourSection}
          {tripDurationSection}
          {deductionSection}
        </div>
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
