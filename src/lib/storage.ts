import { DriverProfile, ShiftSession, PendingIntensive } from './types';
import { localDateStr } from './utils';

const PROFILE_KEY = 'driver_profile';
const SESSIONS_KEY = 'shift_sessions';

export function getProfile(): DriverProfile | null {
  const data = localStorage.getItem(PROFILE_KEY);
  return data ? JSON.parse(data) : null;
}

export function saveProfile(profile: DriverProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getSessions(): ShiftSession[] {
  const data = localStorage.getItem(SESSIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSessions(sessions: ShiftSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getActiveSession(): ShiftSession | null {
  const sessions = getSessions();
  return sessions.find(s => !s.endTime) || null;
}

export function getTodaySessions(): ShiftSession[] {
  return getSessions().filter(s => s.date === localDateStr());
}

const PENDING_INTENSIVES_KEY = 'gbdriver_pending_intensives';

export function getPendingIntensives(): PendingIntensive[] {
  const data = localStorage.getItem(PENDING_INTENSIVES_KEY);
  return data ? JSON.parse(data) : [];
}

export function savePendingIntensives(items: PendingIntensive[]) {
  localStorage.setItem(PENDING_INTENSIVES_KEY, JSON.stringify(items));
}

export function clearPendingIntensives() {
  localStorage.removeItem(PENDING_INTENSIVES_KEY);
}
