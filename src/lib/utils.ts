import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DriverProfile, Entry, ShiftSession } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Single source of truth for the "revenue breakdown" used by both the
 * Analytics earnings-pie card and History's per-month breakdown card.
 *
 * profit + commission + fuelCost + otherExpenses === total, where total is
 * the full revenue (driver's take-home + the platform's commission) earned
 * across the given entries — i.e. the four numbers are a true 100% split of
 * revenue, not take-home-pay-plus-extra-expenses-tacked-on.
 */
export function getRevenueBreakdown(entries: Entry[]): {
  profit: number;
  commission: number;
  fuelCost: number;
  otherExpenses: number;
  total: number;
} {
  const income = entries.filter(e => e.type === 'income');
  const expenses = entries.filter(e => e.type === 'expense');

  const netIncome = income.reduce((s, e) => s + (e.driverNet || 0) + (e.tip || 0), 0);
  const commission = income.reduce((s, e) => s + Math.max(0, (e.appFare || 0) - (e.driverNet || 0)), 0);
  const fuelCost = expenses.filter(e => e.expenseCategory === 'Fuel').reduce((s, e) => s + e.amount, 0);
  const otherExpenses = expenses.filter(e => e.expenseCategory !== 'Fuel').reduce((s, e) => s + e.amount, 0);
  const profit = netIncome - fuelCost - otherExpenses;
  const total = profit + commission + fuelCost + otherExpenses; // === netIncome + commission

  return { profit, commission, fuelCost, otherExpenses, total };
}

/**
 * Single source of truth for "online" (not-paused) shift duration, in
 * milliseconds, as of `asOf` (defaults to now).
 *
 * Online time = (end-or-now − startTime) − totalPausedMs − (time spent in
 * the CURRENT in-progress pause, if any). "Stop"/pause means not-online, so
 * that time must never be counted — this single function is the only place
 * that formula should live; previously it was hand-copied independently in
 * Dashboard.tsx (live timer), EndShiftModal.tsx (end-of-shift preview), and
 * History.tsx (calcStats) — those three could drift from each other (e.g.
 * the EndShiftModal preview froze at modal-mount time instead of ticking),
 * which is what made the live "shift time" look like it ignored pauses
 * while the final saved number told a different story.
 */
export function getOnlineMs(session: ShiftSession, asOf: number = Date.now()): number {
  const start = new Date(session.startTime).getTime();
  const end = session.endTime ? new Date(session.endTime).getTime() : asOf;
  const currentPauseMs = session.pausedAt
    ? Math.max(0, asOf - new Date(session.pausedAt).getTime())
    : 0;
  const pausedMs = (session.totalPausedMs ?? 0) + currentPauseMs;
  return Math.max(0, end - start - pausedMs);
}

/** Same as {@link getOnlineMs}, but in whole seconds (rounds down). */
export function getOnlineSeconds(session: ShiftSession, asOf: number = Date.now()): number {
  return Math.floor(getOnlineMs(session, asOf) / 1000);
}

/** Returns today's date as YYYY-MM-DD in the device's LOCAL timezone.
 *  Use this instead of new Date().toISOString().split('T')[0] which returns
 *  UTC date — incorrect for users in UTC+7 who start their shift before 07:00. */
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converts "HH:mm" string to total minutes since midnight.
 */
function hhmm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Returns the correct session.date for the current moment based on shift settings.
 *
 * - No shift config → falls back to localDateStr() (device local time)
 * - Normal shift    → always today (Thai local)
 * - Night shift     → if current time is BEFORE shiftStart (i.e. the early-morning
 *   portion of the overnight window), the shift that's running started yesterday,
 *   so return yesterday's date.
 *
 * Example: night shift 22:00→07:00, current Thai time 01:30
 *   → 01:30 < 22:00 → return yesterday → session.date = yesterday
 */
export function getShiftDate(profile?: DriverProfile | null): string {
  if (!profile?.shiftStart || !profile?.shiftMode) return localDateStr();

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = hhmm(profile.shiftStart);

  if (profile.shiftMode === 'night' && nowMins < startMins) {
    // Early-morning portion of the overnight shift → date = yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return localDateStr(yesterday);
  }

  return localDateStr(now);
}

/**
 * Returns true if the current local time falls inside the configured shift window.
 * Returns true (no warning) when no shift is configured.
 */
export function isInsideShiftWindow(profile?: DriverProfile | null): boolean {
  if (!profile?.shiftStart || !profile?.shiftEnd || !profile?.shiftMode) return true;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = hhmm(profile.shiftStart);
  const endMins   = hhmm(profile.shiftEnd);

  if (profile.shiftMode === 'night') {
    // Window wraps midnight: inside = (nowMins >= start) OR (nowMins < end)
    return nowMins >= startMins || nowMins < endMins;
  }
  // Normal: inside = start <= now <= end
  return nowMins >= startMins && nowMins <= endMins;
}
