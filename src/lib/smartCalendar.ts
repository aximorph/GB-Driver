import { ShiftSession } from './types';

export type VolumeLevel = 'very_high' | 'high' | 'normal' | 'low' | 'very_low';

export interface ThaiHoliday {
  date: string; // YYYY-MM-DD
  nameEn: string;
  nameTh: string;
}

export interface DayPrediction {
  level: VolumeLevel;
  reasonEn: string;
  reasonTh: string;
  holiday?: ThaiHoliday;
  personalAvg?: number;   // avg total earnings (net + tip) on this DOW
  personalCount?: number; // number of sessions on this DOW
}

// ── Thai public holidays 2024–2027 ──────────────────────────────────────────
// Update this list annually. Substitute (ชดเชย) dates are listed as separate entries.
// Sources: Royal Gazette / Cabinet resolutions each year.
export const THAI_HOLIDAYS: ThaiHoliday[] = [
  // ── 2024 ──────────────────────────────────────────────────────────────────
  { date: '2024-01-01', nameEn: "New Year's Day",            nameTh: 'วันขึ้นปีใหม่' },
  { date: '2024-02-24', nameEn: 'Makha Bucha Day (subst.)',   nameTh: 'วันมาฆบูชา (ชดเชย)' },
  { date: '2024-04-08', nameEn: 'Chakri Day (subst.)',        nameTh: 'วันจักรี (ชดเชย)' },
  { date: '2024-04-12', nameEn: 'Special Holiday',            nameTh: 'วันหยุดพิเศษ' },
  { date: '2024-04-13', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2024-04-14', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2024-04-15', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2024-04-16', nameEn: 'Songkran (subst.)',           nameTh: 'วันสงกรานต์ (ชดเชย)' },
  { date: '2024-05-01', nameEn: 'National Labour Day',        nameTh: 'วันแรงงานแห่งชาติ' },
  { date: '2024-05-06', nameEn: 'Coronation Day (subst.)',    nameTh: 'วันฉัตรมงคล (ชดเชย)' },
  { date: '2024-05-22', nameEn: 'Visakha Bucha Day',          nameTh: 'วันวิสาขบูชา' },
  { date: '2024-06-03', nameEn: "Queen's Birthday",           nameTh: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ' },
  { date: '2024-07-20', nameEn: 'Asalha Bucha Day (subst.)',  nameTh: 'วันอาสาฬหบูชา (ชดเชย)' },
  { date: '2024-07-21', nameEn: 'Wan Khao Phansa',            nameTh: 'วันเข้าพรรษา' },
  { date: '2024-07-22', nameEn: 'Special Holiday',            nameTh: 'วันหยุดพิเศษ' },
  { date: '2024-07-28', nameEn: "King's Birthday",            nameTh: 'วันเฉลิมพระชนมพรรษา รัชกาลที่ 10' },
  { date: '2024-08-12', nameEn: "Mother's Day",               nameTh: 'วันแม่แห่งชาติ' },
  { date: '2024-10-13', nameEn: 'Memorial Day (Rama IX)',     nameTh: 'วันนวมินทรมหาราช' },
  { date: '2024-10-23', nameEn: 'Chulalongkorn Day',          nameTh: 'วันปิยมหาราช' },
  { date: '2024-12-05', nameEn: "Father's Day",               nameTh: 'วันพ่อแห่งชาติ' },
  { date: '2024-12-10', nameEn: 'Constitution Day',           nameTh: 'วันรัฐธรรมนูญ' },
  { date: '2024-12-31', nameEn: "New Year's Eve",             nameTh: 'วันสิ้นปี' },

  // ── 2025 ──────────────────────────────────────────────────────────────────
  { date: '2025-01-01', nameEn: "New Year's Day",             nameTh: 'วันขึ้นปีใหม่' },
  { date: '2025-02-12', nameEn: 'Makha Bucha Day',            nameTh: 'วันมาฆบูชา' },
  { date: '2025-04-07', nameEn: 'Chakri Day (subst.)',        nameTh: 'วันจักรี (ชดเชย)' },
  { date: '2025-04-13', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2025-04-14', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2025-04-15', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2025-05-01', nameEn: 'National Labour Day',        nameTh: 'วันแรงงานแห่งชาติ' },
  { date: '2025-05-05', nameEn: 'Coronation Day (subst.)',    nameTh: 'วันฉัตรมงคล (ชดเชย)' },
  { date: '2025-05-12', nameEn: 'Visakha Bucha Day',          nameTh: 'วันวิสาขบูชา' },
  { date: '2025-06-02', nameEn: 'Special Holiday',            nameTh: 'วันหยุดพิเศษ' },
  { date: '2025-06-03', nameEn: "Queen's Birthday",           nameTh: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ' },
  { date: '2025-07-10', nameEn: 'Asalha Bucha Day',           nameTh: 'วันอาสาฬหบูชา' },
  { date: '2025-07-11', nameEn: 'Wan Khao Phansa',            nameTh: 'วันเข้าพรรษา' },
  { date: '2025-07-28', nameEn: "King's Birthday",            nameTh: 'วันเฉลิมพระชนมพรรษา รัชกาลที่ 10' },
  { date: '2025-08-12', nameEn: "Mother's Day",               nameTh: 'วันแม่แห่งชาติ' },
  { date: '2025-10-13', nameEn: 'Memorial Day (Rama IX)',     nameTh: 'วันนวมินทรมหาราช' },
  { date: '2025-10-23', nameEn: 'Chulalongkorn Day',          nameTh: 'วันปิยมหาราช' },
  { date: '2025-12-05', nameEn: "Father's Day",               nameTh: 'วันพ่อแห่งชาติ' },
  { date: '2025-12-10', nameEn: 'Constitution Day',           nameTh: 'วันรัฐธรรมนูญ' },
  { date: '2025-12-31', nameEn: "New Year's Eve",             nameTh: 'วันสิ้นปี' },

  // ── 2026 ──────────────────────────────────────────────────────────────────
  { date: '2026-01-01', nameEn: "New Year's Day",             nameTh: 'วันขึ้นปีใหม่' },
  { date: '2026-03-01', nameEn: 'Makha Bucha Day',            nameTh: 'วันมาฆบูชา' },
  { date: '2026-03-02', nameEn: 'Makha Bucha (subst.)',       nameTh: 'วันมาฆบูชา (ชดเชย)' },
  { date: '2026-04-06', nameEn: 'Chakri Day',                 nameTh: 'วันจักรี' },
  { date: '2026-04-13', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2026-04-14', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2026-04-15', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2026-05-01', nameEn: 'National Labour Day',        nameTh: 'วันแรงงานแห่งชาติ' },
  { date: '2026-05-04', nameEn: 'Coronation Day',             nameTh: 'วันฉัตรมงคล' },
  { date: '2026-06-01', nameEn: 'Visakha Bucha Day',          nameTh: 'วันวิสาขบูชา' },
  { date: '2026-06-03', nameEn: "Queen's Birthday",           nameTh: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ' },
  { date: '2026-07-28', nameEn: "King's Birthday",            nameTh: 'วันเฉลิมพระชนมพรรษา รัชกาลที่ 10' },
  { date: '2026-07-29', nameEn: 'Asalha Bucha Day',           nameTh: 'วันอาสาฬหบูชา' },
  { date: '2026-07-30', nameEn: 'Wan Khao Phansa',            nameTh: 'วันเข้าพรรษา' },
  { date: '2026-08-12', nameEn: "Mother's Day",               nameTh: 'วันแม่แห่งชาติ' },
  { date: '2026-10-13', nameEn: 'Memorial Day (Rama IX)',     nameTh: 'วันนวมินทรมหาราช' },
  { date: '2026-10-23', nameEn: 'Chulalongkorn Day',          nameTh: 'วันปิยมหาราช' },
  { date: '2026-12-05', nameEn: "Father's Day",               nameTh: 'วันพ่อแห่งชาติ' },
  { date: '2026-12-10', nameEn: 'Constitution Day',           nameTh: 'วันรัฐธรรมนูญ' },
  { date: '2026-12-31', nameEn: "New Year's Eve",             nameTh: 'วันสิ้นปี' },

  // ── 2027 (approximate — update when government announces) ─────────────────
  { date: '2027-01-01', nameEn: "New Year's Day",             nameTh: 'วันขึ้นปีใหม่' },
  { date: '2027-04-06', nameEn: 'Chakri Day',                 nameTh: 'วันจักรี' },
  { date: '2027-04-13', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2027-04-14', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2027-04-15', nameEn: 'Songkran Day',               nameTh: 'วันสงกรานต์' },
  { date: '2027-05-01', nameEn: 'National Labour Day',        nameTh: 'วันแรงงานแห่งชาติ' },
  { date: '2027-07-28', nameEn: "King's Birthday",            nameTh: 'วันเฉลิมพระชนมพรรษา รัชกาลที่ 10' },
  { date: '2027-08-12', nameEn: "Mother's Day",               nameTh: 'วันแม่แห่งชาติ' },
  { date: '2027-10-23', nameEn: 'Chulalongkorn Day',          nameTh: 'วันปิยมหาราช' },
  { date: '2027-12-05', nameEn: "Father's Day",               nameTh: 'วันพ่อแห่งชาติ' },
  { date: '2027-12-10', nameEn: 'Constitution Day',           nameTh: 'วันรัฐธรรมนูญ' },
  { date: '2027-12-31', nameEn: "New Year's Eve",             nameTh: 'วันสิ้นปี' },
];

// ── Helper functions ─────────────────────────────────────────────────────────

const holidayMap = new Map<string, ThaiHoliday>(THAI_HOLIDAYS.map(h => [h.date, h]));

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str: string): Date {
  // Parse as local date (avoid timezone shift)
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isPublicHoliday(str: string): boolean {
  return holidayMap.has(str);
}

function isWeekend(str: string): boolean {
  const dow = parseDate(str).getDay();
  return dow === 0 || dow === 6;
}

function isDayOff(str: string): boolean {
  return isPublicHoliday(str) || isWeekend(str);
}

/**
 * A work day is a "bridge day" (วันพักสะพาน) when it sits between two holiday
 * days on both sides. Most people take leave on bridge days to extend their break,
 * so demand behaves more like a holiday than a work day.
 *
 * Example: Sat–Sun off │ Mon WORK │ Tue off  →  Mon is a bridge day.
 */
function isBridgeDay(str: string): boolean {
  if (isDayOff(str)) return false;
  const d = parseDate(str);
  return isDayOff(toDateStr(addDays(d, -1))) && isDayOff(toDateStr(addDays(d, 1)));
}

/** A day that belongs to a holiday cluster: actual day off OR bridge day. */
function isClusterDay(str: string): boolean {
  return isDayOff(str) || isBridgeDay(str);
}

interface ClusterInfo {
  start: string;  // YYYY-MM-DD of first day in cluster
  end: string;    // YYYY-MM-DD of last day in cluster
  len: number;    // total calendar days (holidays + bridges)
}

/**
 * Find the full effective cluster that contains `dateStr`.
 * Walks backward and forward as long as each adjacent day is a cluster day.
 * Only call this when isClusterDay(dateStr) is already true.
 */
function getEffectiveCluster(dateStr: string): ClusterInfo {
  let start = parseDate(dateStr);
  for (let i = 0; i < 30; i++) {
    if (!isClusterDay(toDateStr(addDays(start, -1)))) break;
    start = addDays(start, -1);
  }

  let end = parseDate(dateStr);
  for (let i = 0; i < 30; i++) {
    if (!isClusterDay(toDateStr(addDays(end, 1)))) break;
    end = addDays(end, 1);
  }

  const len = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return { start: toDateStr(start), end: toDateStr(end), len };
}

// ── DOW base levels (Mon=1 … Sun=0 in JS) ────────────────────────────────────
const DOW_LEVEL: Record<number, VolumeLevel> = {
  0: 'low',    // Sunday
  1: 'high',   // Monday
  2: 'normal', // Tuesday
  3: 'normal', // Wednesday
  4: 'normal', // Thursday
  5: 'high',   // Friday
  6: 'normal', // Saturday (normal-to-high; kept "normal" so holiday logic can elevate it)
};

const DOW_REASON_EN: Record<number, string> = {
  0: 'Day before work week — people stay home',
  1: 'Start of work week — high demand',
  2: 'Midweek — normal demand',
  3: 'Midweek — normal demand',
  4: 'Midweek — normal demand',
  5: 'End of work week — people going out',
  6: 'Weekend — moderate demand',
};

const DOW_REASON_TH: Record<number, string> = {
  0: 'ก่อนเริ่มสัปดาห์ทำงาน — คนอยู่บ้าน',
  1: 'ต้นสัปดาห์ — ความต้องการสูง',
  2: 'กลางสัปดาห์ — ปริมาณปกติ',
  3: 'กลางสัปดาห์ — ปริมาณปกติ',
  4: 'กลางสัปดาห์ — ปริมาณปกติ',
  5: 'ก่อนหยุดสุดสัปดาห์ — คนออกเยอะ',
  6: 'วันหยุดสุดสัปดาห์ — ปริมาณปานกลาง',
};

// ── Personal stats ────────────────────────────────────────────────────────────

export interface PersonalDowStats {
  total: number;
  count: number;
}

/** Build per-DOW personal earnings stats from completed sessions. */
export function buildPersonalStats(sessions: ShiftSession[]): Record<number, PersonalDowStats> {
  const stats: Record<number, PersonalDowStats> = {};
  for (let i = 0; i < 7; i++) stats[i] = { total: 0, count: 0 };

  for (const s of sessions) {
    if (!s.endTime) continue;
    const dow = parseDate(s.date).getDay();
    const earnings = s.entries
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + (e.driverNet || 0) + (e.tip || 0), 0);
    stats[dow].total += earnings;
    stats[dow].count++;
  }
  return stats;
}

// ── Main prediction function ──────────────────────────────────────────────────

/**
 * Predict ride-volume level for a given date using the Effective Cluster model.
 *
 * ── Cluster model ────────────────────────────────────────────────────────────
 * An "effective cluster" is a run of calendar days that are either:
 *   • actual days off (public holiday / weekend), OR
 *   • bridge days (work days sandwiched between two holiday days — most people
 *     take leave on these to get a continuous break).
 *
 * Once the cluster length is known, levels are assigned by position:
 *
 *   Work day BEFORE cluster:
 *     len ≥ 3  →  VERY_HIGH  (people celebrate / rush errands before long break)
 *     len = 2  →  HIGH       (normal Friday-before-weekend boost)
 *     len = 1  →  NORMAL     (no boost — isolated single holiday, no celebration)
 *
 *   First day of cluster (len ≥ 3):  HIGH   (people are out and active)
 *   Middle day(s) of cluster:        NORMAL (settled into break)
 *   Bridge day (any cluster len):    NORMAL (reduced demand; most people on leave)
 *   Last day of cluster:
 *     len ≥ 3  →  VERY_LOW   (people stay home, dreading work tomorrow)
 *     len ≤ 2  →  use DOW base (low / normal per DOW table)
 *
 *   Short cluster (len ≤ 2, not a bridge):  use DOW base (Sat=normal, Sun=low)
 *   Single isolated holiday (len = 1):      LOW
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function predictDay(
  dateStr: string,
  personalStats?: Record<number, PersonalDowStats>,
): DayPrediction {
  const date    = parseDate(dateStr);
  const dow     = date.getDay();
  const holiday = holidayMap.get(dateStr);

  let level: VolumeLevel;
  let reasonEn: string;
  let reasonTh: string;

  if (isClusterDay(dateStr)) {
    // ── Inside a cluster (holiday, weekend, or bridge day) ───────────────────
    const cluster = getEffectiveCluster(dateStr);
    const { len, start, end } = cluster;
    const isFirst  = dateStr === start;
    const isLast   = dateStr === end;
    const isBridge = isBridgeDay(dateStr);

    if (isBridge) {
      // Bridge day: demand is reduced (most people take leave)
      level    = 'normal';
      reasonEn = 'Bridge day — most people extend their holiday';
      reasonTh = 'วันพักสะพาน — คนส่วนใหญ่ลาหยุดต่อเนื่อง';

    } else if (len >= 3) {
      // Long cluster — position matters
      if (isFirst) {
        level    = 'high';
        reasonEn = `First day of ${len}-day holiday — people are out`;
        reasonTh = `วันแรกของวันหยุดยาว ${len} วัน — คนออกมาเที่ยว`;
      } else if (isLast) {
        level    = 'very_low';
        reasonEn = `Last day of ${len}-day holiday — people staying in`;
        reasonTh = `วันสุดท้ายของวันหยุดยาว ${len} วัน — งานน้อยมาก`;
      } else {
        // Middle of long cluster
        level    = 'normal';
        reasonEn = 'Mid-holiday — demand settles down';
        reasonTh = 'กลางช่วงวันหยุด — ปริมาณงานปานกลาง';
      }

    } else if (len === 1) {
      // Isolated single holiday (no adjacent days off or bridges)
      level    = 'low';
      reasonEn = 'Isolated holiday — most people resting at home';
      reasonTh = 'วันหยุดวันเดียว — คนส่วนใหญ่พักอยู่บ้าน';

    } else {
      // Short cluster (len = 2): regular weekend or 2-day holiday
      // Keep DOW base so Sat=normal, Sun=low
      level    = DOW_LEVEL[dow];
      reasonEn = DOW_REASON_EN[dow];
      reasonTh = DOW_REASON_TH[dow];
    }

  } else {
    // ── Regular work day ─────────────────────────────────────────────────────
    const tomorrowStr = toDateStr(addDays(date, 1));

    if (isClusterDay(tomorrowStr)) {
      // Tomorrow begins (or is part of) a cluster — get its full effective length
      const tomorrowCluster = getEffectiveCluster(tomorrowStr);
      const effectiveLen    = tomorrowCluster.len;

      if (effectiveLen >= 3) {
        level    = 'very_high';
        reasonEn = `Day before ${effectiveLen}-day holiday — ride surge`;
        reasonTh = `วันก่อนหยุดยาว ${effectiveLen} วัน — งานเยอะมาก`;
      } else if (effectiveLen >= 2) {
        level    = 'high';
        reasonEn = 'Day before the weekend — good demand';
        reasonTh = 'วันก่อนสุดสัปดาห์ — ความต้องการดี';
      } else {
        // effectiveLen = 1: isolated single holiday tomorrow — no boost
        level    = DOW_LEVEL[dow];
        reasonEn = DOW_REASON_EN[dow];
        reasonTh = DOW_REASON_TH[dow];
      }
    } else {
      // Normal work day, no holiday nearby
      level    = DOW_LEVEL[dow];
      reasonEn = DOW_REASON_EN[dow];
      reasonTh = DOW_REASON_TH[dow];
    }
  }

  // ── Personal stats for this DOW ──────────────────────────────────────────────
  let personalAvg: number | undefined;
  let personalCount: number | undefined;
  if (personalStats) {
    const stat = personalStats[dow];
    if (stat.count >= 2) {
      personalAvg   = Math.round(stat.total / stat.count);
      personalCount = stat.count;
    }
  }

  return { level, reasonEn, reasonTh, holiday, personalAvg, personalCount };
}

// ── Calendar grid builder ─────────────────────────────────────────────────────

/** Returns an array of YYYY-MM-DD strings (or null for padding) for a month grid. */
export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // JS dow: Sun=0 … Sat=6. We want Mon=0 … Sun=6.
  const startPad = (firstDay.getDay() + 6) % 7;

  const cells: (string | null)[] = Array<null>(startPad).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
