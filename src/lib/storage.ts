import { DriverProfile, ShiftSession } from './types';

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
  const today = new Date().toISOString().split('T')[0];
  return getSessions().filter(s => s.date === today);
}
