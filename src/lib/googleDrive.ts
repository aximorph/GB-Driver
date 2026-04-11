import { getSessions, getProfile, saveSessions, saveProfile } from './storage';

declare global {
  interface Window {
    google: any;
  }
}

const CLIENT_ID = '540767703144-9h94ro0h0nu4rrsr9m9g0svedm6a2cga.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any = null;
// Use localStorage so "connected" state persists across sessions
// (actual token still expires, but UI remembers user was connected)
let accessToken: string | null = localStorage.getItem('gdrive_token');

export function isGoogleConnected(): boolean {
  return !!accessToken;
}

export function disconnectGoogle() {
  if (accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    } catch (e) {}
  }
  accessToken = null;
  localStorage.removeItem('gdrive_token');
}

export function initGoogleIdentity(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google && window.google.accounts) {
      setupClient();
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setupClient();
      resolve();
    };
    document.body.appendChild(script);
  });
}

function setupClient() {
  if (tokenClient) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response: any) => {
      if (response && response.access_token) {
        accessToken = response.access_token;
        localStorage.setItem('gdrive_token', response.access_token);
      }
    },
  });
}

export function requestGoogleLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) reject(new Error('Google Client not initialized'));
    tokenClient.callback = (response: any) => {
      if (response.error) {
        reject(response);
      } else {
        accessToken = response.access_token;
        localStorage.setItem('gdrive_token', response.access_token);
        resolve(response.access_token);
      }
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

async function findBackupFileId(): Promise<string | null> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='gb-driver-backup.json' and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) throw new Error('Search failed');
  const searchData = await searchRes.json();
  return searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;
}

export async function restoreFromDrive(): Promise<boolean> {
  if (!accessToken) throw new Error('Not logged in to Google');

  const fileId = await findBackupFileId();
  if (!fileId) return false; // No backup file found on Drive

  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!downloadRes.ok) throw new Error('Download failed');

  const data = await downloadRes.json();

  if (data.sessions) saveSessions(data.sessions);
  if (data.profile) saveProfile(data.profile);

  return true;
}

export async function backupDataToDrive() {
  if (!accessToken) throw new Error('Not logged in to Google');

  const data = JSON.stringify({
    sessions: getSessions(),
    profile: getProfile()
  });

  // Find existing file
  let fileId = await findBackupFileId();

  // If new, create metadata first
  if (!fileId) {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'gb-driver-backup.json', mimeType: 'application/json' })
    });
    if (!createRes.ok) throw new Error('Failed to create file metadata');
    const created = await createRes.json();
    fileId = created.id;
  }

  // Upload data payload
  const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: data
  });

  if (!uploadRes.ok) throw new Error('Upload failed');
  return uploadRes.json();
}
