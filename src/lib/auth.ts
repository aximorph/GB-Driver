/**
 * auth.ts
 * Manages authentication mode: 'google' | 'guest' | null
 * Keeps auth concern separate from googleDrive.ts (which handles OAuth tokens).
 */

export type AuthMode = 'google' | 'guest' | null;

const AUTH_KEY = 'gbdriver_auth_mode';

export function getAuthMode(): AuthMode {
  return (localStorage.getItem(AUTH_KEY) as AuthMode) ?? null;
}

export function setAuthMode(mode: AuthMode): void {
  if (mode === null) localStorage.removeItem(AUTH_KEY);
  else localStorage.setItem(AUTH_KEY, mode);
}

export function isGuestMode(): boolean {
  return getAuthMode() === 'guest';
}

export function isAuthenticated(): boolean {
  return getAuthMode() !== null;
}
