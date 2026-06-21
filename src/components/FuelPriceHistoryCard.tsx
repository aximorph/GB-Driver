import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths } from 'date-fns';
import { useT } from '@/context/LangContext';
import { TranslationKey } from '@/lib/i18n';
import { getFuelHistory, FuelHistoryEntry, FuelType } from '@/lib/fuelHistoryApi';

const GREEN  = 'hsl(145, 100%, 45%)';
const YELLOW = 'hsl(54,  100%, 62%)';
const RED    = 'hsl(0,   76%,  60%)';
const ORANGE = 'hsl(25,  95%,  55%)';
const CYAN   = 'hsl(190, 90%,  55%)';
const MOSS   = 'hsl(110, 65%,  50%)';
const VIOLET = 'hsl(280, 70%,  65%)';
const PINK   = 'hsl(330, 80%,  65%)';

const TOOLTIP_STYLE = {
  background: 'hsl(220, 33%, 7%)',
  border: '1px solid hsl(220, 20%, 18%)',
  borderRadius: 8,
  fontSize: 12,
};
const TICK = { fontSize: 10, fill: 'hsl(215, 16%, 52%)' };

// Station key → { translation key, line color }. Order = legend order.
const STATION_META: { key: string; labelKey: TranslationKey; color: string }[] = [
  { key: 'ptt',    labelKey: 'fuel_station_ptt',    color: RED },
  { key: 'bcp',    labelKey: 'fuel_station_bcp',    color: GREEN },
  { key: 'shell',  labelKey: 'fuel_station_shell',  color: YELLOW },
  { key: 'caltex', labelKey: 'fuel_station_caltex', color: ORANGE },
  { key: 'irpc',   labelKey: 'fuel_station_irpc',   color: CYAN },
  { key: 'pt',     labelKey: 'fuel_station_pt',     color: MOSS },
  { key: 'susco',  labelKey: 'fuel_station_susco',  color: VIOLET },
  { key: 'pure',   labelKey: 'fuel_station_pure',   color: PINK },
];

// Fuel-type tabs in display order.
const FUEL_TYPE_OPTS: { key: FuelType; labelKey: TranslationKey }[] = [
  { key: 'gasohol_95',         labelKey: 'fuel_type_gasohol_95' },
  { key: 'gasohol_91',         labelKey: 'fuel_type_gasohol_91' },
  { key: 'gasohol_e20',        labelKey: 'fuel_type_gasohol_e20' },
  { key: 'gasohol_e85',        labelKey: 'fuel_type_gasohol_e85' },
  { key: 'diesel',             labelKey: 'fuel_type_diesel' },
  { key: 'premium_diesel',     labelKey: 'fuel_type_premium_diesel' },
  { key: 'premium_gasohol_95', labelKey: 'fuel_type_premium_gasohol_95' },
  { key: 'gasoline_95',        labelKey: 'fuel_type_gasoline_95' },
];

type RangeMonths = 6 | 12 | 24;

export default function FuelPriceHistoryCard() {
  const t = useT();
  const [history, setHistory] = useState<FuelHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [fuelType, setFuelType] = useState<FuelType>('gasohol_95');
  const [range, setRange] = useState<RangeMonths>(6);

  useEffect(() => {
    let cancelled = false;
    getFuelHistory()
      .then(data => { if (!cancelled) setHistory(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  // Only show fuel-type tabs / stations that actually have at least one data point for that fuel type.
  const availableFuelTypes = useMemo(() => {
    if (!history) return FUEL_TYPE_OPTS;
    const present = new Set<string>();
    history.forEach(h => Object.values(h.stations).forEach(s => Object.keys(s).forEach(k => present.add(k))));
    const filtered = FUEL_TYPE_OPTS.filter(o => present.has(o.key));
    return filtered.length > 0 ? filtered : FUEL_TYPE_OPTS;
  }, [history]);

  // Keep selected fuel type valid once data loads
  useEffect(() => {
    if (history && availableFuelTypes.length > 0 && !availableFuelTypes.some(o => o.key === fuelType)) {
      setFuelType(availableFuelTypes[0].key);
    }
  }, [history, availableFuelTypes, fuelType]);

  const { chartData, activeStations } = useMemo(() => {
    if (!history) return { chartData: [], activeStations: [] as typeof STATION_META };

    const cutoff = subMonths(new Date(), range).getTime();
    const inRange = history.filter(h => new Date(h.date).getTime() >= cutoff);

    const stationsWithData = STATION_META.filter(st =>
      inRange.some(h => h.stations[st.key]?.[fuelType] !== undefined)
    );

    const data = inRange.map(h => {
      const row: Record<string, string | number> = { date: format(new Date(h.date), 'MM/dd') };
      stationsWithData.forEach(st => {
        const v = h.stations[st.key]?.[fuelType];
        if (v !== undefined) row[st.key] = v;
      });
      return row;
    });

    return { chartData: data, activeStations: stationsWithData };
  }, [history, range, fuelType]);

  const RANGE_OPTS: { value: RangeMonths; labelKey: TranslationKey }[] = [
    { value: 6,  labelKey: 'analytics_fuel_range_6m' },
    { value: 12, labelKey: 'analytics_fuel_range_12m' },
    { value: 24, labelKey: 'analytics_fuel_range_24m' },
  ];

  return (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('analytics_fuel_title')}</h3>
        <div className="flex bg-secondary/60 p-0.5 rounded-xl border border-white/5 gap-0.5">
          {RANGE_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                range === opt.value
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Fuel-type tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
        {availableFuelTypes.map(opt => (
          <button
            key={opt.key}
            onClick={() => setFuelType(opt.key)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border ${
              fuelType === opt.key
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-secondary/40 text-muted-foreground border-white/5 hover:text-white'
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-xs text-muted-foreground text-center py-8">{t('analytics_fuel_error')}</p>
      ) : history === null ? (
        <p className="text-xs text-muted-foreground text-center py-8">{t('analytics_fuel_loading')}</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={TICK} />
              <YAxis tick={TICK} width={36} domain={['auto', 'auto']} unit="" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, name: string) => [`฿${Number(v).toFixed(2)}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activeStations.map(st => (
                <Line
                  key={st.key}
                  type="monotone"
                  dataKey={st.key}
                  name={t(st.labelKey)}
                  stroke={st.color}
                  strokeWidth={2}
                  dot={chartData.length <= 14}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {chartData.length < 5 && (
            <p className="text-[10.5px] text-muted-foreground text-center leading-relaxed pt-1 border-t border-white/5">
              {t('analytics_fuel_collecting')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
