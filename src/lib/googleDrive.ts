import { getSessions, getProfile, saveSessions, saveProfile } from './storage';

declare global {
  interface Window { google: any; }
}

const CLIENT_ID = '540767703144-9h94ro0h0nu4rrsr9m9g0svedm6a2cga.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY        = 'gdrive_token';
const TOKEN_DATE_KEY   = 'gdrive_token_date';
const TOKEN_EXPIRY_KEY = 'gdrive_token_expiry'; // ms timestamp when token expires
const TOKEN_LIFETIME   = 3500 * 1000;           // 3500s — conservative (actual 3600s)

let tokenClient: any = null;
let accessToken: string | null = null;

// ── Token persistence ─────────────────────────────────────────────────────────

function loadToken(): string | null {
  const token  = localStorage.getItem(TOKEN_KEY);
  const date   = localStorage.getItem(TOKEN_DATE_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0', 10);
  const today  = new Date().toISOString().split('T')[0];

  if (token && date === today && Date.now() < expiry) return token;

  // Expired or wrong day — clear stored token
  if (token) clearStoredToken();
  return null;
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_DATE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

function saveToken(token: string) {
  const today = new Date().toISOString().split('T')[0];
  accessToken = token;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_DATE_KEY, today);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_LIFETIME));
}

accessToken = loadToken();

// ── Public helpers ────────────────────────────────────────────────────────────

export function isGoogleConnected(): boolean {
  if (!accessToken) return false;
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0', 10);
  return Date.now() < expiry;
}

export function disconnectGoogle() {
  if (accessToken && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(accessToken, () => {}); } catch {}
  }
  accessToken = null;
  clearStoredToken();
  localStorage.removeItem('gdrive_last_sync');
}

// ── Midnight auto-logout ──────────────────────────────────────────────────────

export function scheduleMidnightExpiry() {
  const now      = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  setTimeout(() => {
    disconnectGoogle();
    window.dispatchEvent(new CustomEvent('gbdriver:google-disconnected'));
  }, midnight.getTime() - now.getTime());
}

// ── GIS client setup ──────────────────────────────────────────────────────────

export function initGoogleIdentity(): Promise<void> {
  return new Promise(resolve => {
    if (window.google?.accounts) { setupClient(); resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => { setupClient(); resolve(); };
    document.body.appendChild(s);
  });
}

function setupClient() {
  if (tokenClient) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (res: any) => { if (res?.access_token) saveToken(res.access_token); },
  });
}

export function requestGoogleLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('Google Client not initialized')); return; }
    tokenClient.callback = (res: any) => {
      if (res.error) reject(res);
      else { saveToken(res.access_token); resolve(res.access_token); }
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// Silent refresh — no popup if user's Google session is still active
function refreshTokenSilently(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('Client not ready')); return; }
    tokenClient.callback = (res: any) => {
      if (res.error) reject(new Error(res.error));
      else { saveToken(res.access_token); resolve(res.access_token); }
    };
    tokenClient.requestAccessToken({ prompt: '' }); // empty = silent
  });
}

// ── Token-aware fetch ─────────────────────────────────────────────────────────
// Tries the request; on 401 attempts a silent refresh once, then retries.
// If refresh fails, fires gbdriver:google-disconnected so the UI shows the
// "login required" popup instead of silently dropping the operation.

async function authedFetch(input: string, init: RequestInit): Promise<Response> {
  // Proactively refresh if we know the token is about to expire / already expired
  if (!isGoogleConnected() && accessToken) {
    try {
      await refreshTokenSilently();
    } catch {
      disconnectGoogle();
      window.dispatchEvent(new CustomEvent('gbdriver:google-disconnected'));
      throw new Error('Session expired — please log in again.');
    }
  }

  const makeReq = () => fetch(input, {
    ...init,
    headers: { ...(init.headers as Record<string, string> ?? {}), Authorization: `Bearer ${accessToken}` },
  });

  let res = await makeReq();

  if (res.status === 401) {
    // Token rejected by server — try silent refresh once
    try {
      await refreshTokenSilently();
      res = await makeReq();
    } catch {
      disconnectGoogle();
      window.dispatchEvent(new CustomEvent('gbdriver:google-disconnected'));
      throw new Error('Session expired — please log in again.');
    }
  }

  return res;
}

// ── Drive operations ──────────────────────────────────────────────────────────

async function findBackupFileId(): Promise<string | null> {
  const res = await authedFetch(
    `https://www.googleapis.com/drive/v3/files?q=name='gb-driver-backup.json' and trashed=false`,
    {}
  );
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.files?.length > 0 ? data.files[0].id : null;
}

export async function restoreFromDrive(): Promise<boolean> {
  if (!accessToken) throw new Error('Not logged in to Google');

  const fileId = await findBackupFileId();
  if (!fileId) return false;

  const res = await authedFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {}
  );
  if (!res.ok) throw new Error('Download failed');

  const data = await res.json();
  if (data.sessions) saveSessions(data.sessions);
  if (data.profile)  saveProfile(data.profile);
  return true;
}

export async function backupDataToDrive() {
  if (!accessToken) throw new Error('Not logged in to Google');

  const body = JSON.stringify({ sessions: getSessions(), profile: getProfile() });

  let fileId = await findBackupFileId();

  if (!fileId) {
    const createRes = await authedFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'gb-driver-backup.json', mimeType: 'application/json' }),
    });
    if (!createRes.ok) throw new Error('Failed to create file metadata');
    fileId = (await createRes.json()).id;
  }

  const uploadRes = await authedFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }
  );
  if (!uploadRes.ok) throw new Error('Upload failed');
  return uploadRes.json();
}
