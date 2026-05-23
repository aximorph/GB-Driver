import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  VolumeLevel,
  DayPrediction,
  buildMonthGrid,
  buildPersonalStats,
  predictDay,
  toDateStr,
} from '@/lib/smartCalendar';
import { getSessions } from '@/lib/storage';
import { useT, useLang } from '@/context/LangContext';

// ── Level config ──────────────────────────────────────────────────────────────

const LEVEL_CFG: Record<VolumeLevel, {
  dot: string;
  text: string;
  badge: string;
  bar: string;
}> = {
  very_high: {
    dot:   'bg-primary',
    text:  'text-primary',
    badge: 'bg-primary/15 border-primary/30 text-primary',
    bar:   'bg-primary',
  },
  high: {
    dot:   'bg-yellow-400',
    text:  'text-yellow-400',
    badge: 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400',
    bar:   'bg-yellow-400',
  },
  normal: {
    dot:   'bg-white/30',
    text:  'text-muted-foreground',
    badge: 'bg-white/5 border-white/15 text-muted-foreground',
    bar:   'bg-white/30',
  },
  low: {
    dot:   'bg-orange-400',
    text:  'text-orange-400',
    badge: 'bg-orange-400/15 border-orange-400/30 text-orange-400',
    bar:   'bg-orange-400',
  },
  very_low: {
    dot:   'bg-destructive',
    text:  'text-destructive',
    badge: 'bg-destructive/15 border-destructive/30 text-destructive',
    bar:   'bg-destructive',
  },
};

// ── Thai/EN month & day names ─────────────────────────────────────────────────

const MONTH_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTH_EN = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

const DOW_SHORT_TH = ['จ','อ','พ','พฤ','ศ','ส','อา'];
const DOW_SHORT_EN = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const DOW_FULL_TH = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
const DOW_FULL_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// JS getDay() → Mon-based index (0=Mon … 6=Sun)
function toMonIdx(jsDow: number) { return (jsDow + 6) % 7; }

// ── Level label helpers ───────────────────────────────────────────────────────

function levelLabelTH(l: VolumeLevel) {
  return { very_high: 'สูงมาก', high: 'สูง', normal: 'ปกติ', low: 'น้อย', very_low: 'น้อยมาก' }[l];
}
function levelLabelEN(l: VolumeLevel) {
  return { very_high: 'Very High', high: 'High', normal: 'Normal', low: 'Low', very_low: 'Very Low' }[l];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmartCalendarCard() {
  const t        = useT();
  const { lang } = useLang();
  const isTH     = lang === 'th';

  const today = toDateStr(new Date());
  const now   = new Date();

  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-based
  const [selected,  setSelected]  = useState<string>(today);

  // ── personal stats (memoized) ─────────────────────────────────────────────
  const personalStats = useMemo(() => {
    const sessions = getSessions().filter(s => s.endTime);
    return buildPersonalStats(sessions);
  }, []);

  // ── calendar grid ─────────────────────────────────────────────────────────
  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  // ── prediction for selected day ───────────────────────────────────────────
  const prediction: DayPrediction | null = useMemo(
    () => (selected ? predictDay(selected, personalStats) : null),
    [selected, personalStats],
  );

  // ── navigation ────────────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // ── render ────────────────────────────────────────────────────────────────
  const dowShort = isTH ? DOW_SHORT_TH : DOW_SHORT_EN;
  const months   = isTH ? MONTH_TH : MONTH_EN;

  return (
    <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-primary opacity-80" />
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t('cal_title')}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-bold text-white w-32 text-center">
            {months[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Day-of-week header ───────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-0.5">
        {dowShort.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-0.5 -mt-2">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />;

          const pred    = predictDay(cell, personalStats);
          const cfg     = LEVEL_CFG[pred.level];
          const isToday = cell === today;
          const isSel   = cell === selected;
          const dayNum  = parseInt(cell.split('-')[2], 10);

          return (
            <button
              key={cell}
              onClick={() => setSelected(cell)}
              className={[
                'flex flex-col items-center justify-center rounded-xl py-1.5 transition-all',
                isSel
                  ? 'bg-white/10 border border-white/20 shadow-sm'
                  : 'hover:bg-white/5',
                isToday && !isSel
                  ? 'border border-primary/40'
                  : !isSel ? 'border border-transparent' : '',
              ].join(' ')}
            >
              <span className={`text-[11px] font-semibold leading-none ${isToday ? 'text-primary' : 'text-white/80'}`}>
                {dayNum}
              </span>
              <div className={`mt-1 w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            </button>
          );
        })}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {(['very_high', 'high', 'normal', 'low', 'very_low'] as VolumeLevel[]).map(lv => (
          <div key={lv} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${LEVEL_CFG[lv].dot}`} />
            <span className={`text-[10px] ${LEVEL_CFG[lv].text}`}>
              {isTH ? levelLabelTH(lv) : levelLabelEN(lv)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Selected day detail ───────────────────────────────────────────── */}
      {prediction && selected && (
        <SelectedDayDetail
          dateStr={selected}
          prediction={prediction}
          isTH={isTH}
          isToday={selected === today}
        />
      )}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function SelectedDayDetail({
  dateStr,
  prediction,
  isTH,
  isToday,
}: {
  dateStr: string;
  prediction: DayPrediction;
  isTH: boolean;
  isToday: boolean;
}) {
  const cfg   = LEVEL_CFG[prediction.level];
  const label = isTH ? levelLabelTH(prediction.level) : levelLabelEN(prediction.level);

  // Build readable date label
  const d         = new Date(dateStr + 'T00:00:00');
  const monIdx    = toMonIdx(d.getDay()); // 0=Mon … 6=Sun
  const dowFull   = isTH ? DOW_FULL_TH[monIdx] : DOW_FULL_EN[monIdx];
  const dayNum    = d.getDate();
  const monthName = isTH ? MONTH_TH[d.getMonth()] : MONTH_EN[d.getMonth()];
  const year      = d.getFullYear();

  const dateLabel = isTH
    ? `วัน${dowFull}ที่ ${dayNum} ${monthName} ${year + 543}`
    : `${dowFull}, ${dayNum} ${monthName} ${year}`;

  // DOW full for personal stats label
  const dowFull0 = isTH ? DOW_FULL_TH[monIdx] : DOW_FULL_EN[monIdx];

  // Bar widths for volume visualisation (very_high=100%, high=75%, normal=50%, low=30%, very_low=15%)
  const barPct: Record<VolumeLevel, number> = {
    very_high: 100, high: 75, normal: 50, low: 30, very_low: 15,
  };

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${cfg.badge}`}>

      {/* date + today badge */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs font-bold text-white/90 leading-tight">{dateLabel}</p>
          {prediction.holiday && (
            <p className="text-[10px] text-white/60 mt-0.5">
              🎌 {isTH ? prediction.holiday.nameTh : prediction.holiday.nameEn}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isToday && (
            <span className="text-[9px] font-black bg-white/10 border border-white/20 text-white/70 px-1.5 py-0.5 rounded-md">
              {isTH ? 'วันนี้' : 'TODAY'}
            </span>
          )}
          <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${cfg.badge}`}>
            {label}
          </span>
        </div>
      </div>

      {/* Volume bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/50 font-medium">
            {isTH ? 'ระดับปริมาณงานที่คาด' : 'Expected volume'}
          </span>
          <span className={`text-[10px] font-bold ${cfg.text}`}>{label}</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
            style={{ width: `${barPct[prediction.level]}%` }}
          />
        </div>
      </div>

      {/* Reason */}
      <p className="text-[11px] text-white/70 leading-relaxed">
        {isTH ? prediction.reasonTh : prediction.reasonEn}
      </p>

      {/* Personal stats */}
      <div className="border-t border-white/10 pt-3 space-y-1.5">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
          {isTH ? 'สถิติของคุณ' : 'Your stats'}
        </p>
        {prediction.personalAvg !== undefined && prediction.personalCount !== undefined ? (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/60">
              {isTH
                ? `เฉลี่ยวัน${dowFull0}`
                : `Avg on ${dowFull0}`}
            </span>
            <div className="text-right">
              <span className="font-mono font-bold text-sm text-white">
                ฿{prediction.personalAvg.toLocaleString()}
              </span>
              <span className="text-[10px] text-white/40 ml-1.5">
                ({prediction.personalCount} {isTH ? 'กะ' : 'sessions'})
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-white/40 italic">
            {isTH
              ? 'ยังไม่มีข้อมูลพอสำหรับวันนี้ (ต้องการ ≥ 2 กะ)'
              : 'Not enough data yet for this day (need ≥ 2 sessions)'}
          </p>
        )}
      </div>
    </div>
  );
}
