import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DriverProfile } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
