// GitHub Sync Module
// Reads and writes app data (students, staff, attendance) to a JSON file in a GitHub repo.
// Functions throw on network/API errors so the UI can show an accurate sync status.

const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const REPO = import.meta.env.VITE_GITHUB_REPO;
const DATA_PATH = import.meta.env.VITE_GITHUB_DATA_PATH || 'data.json';
const API_BASE = `https://api.github.com/repos/${REPO}/contents/${DATA_PATH}`;

let currentSha = null; // Required by GitHub API to update a file

const headers = () => ({
  'Authorization': `Bearer ${TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'Content-Type': 'application/json',
});

// UTF-8 safe base64 helpers (plain atob/btoa break names like "Zoë")
const decodeBase64Utf8 = (b64) => {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const encodeBase64Utf8 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

/**
 * Check if GitHub sync is configured.
 */
export function isGitHubSyncEnabled() {
  return !!(TOKEN && REPO);
}

/**
 * Fetch all data from GitHub.
 * Returns { students, staff, attendance } or null if no data exists yet.
 * Throws on network / API errors.
 */
export async function fetchDataFromGitHub() {
  if (!isGitHubSyncEnabled()) return null;

  const res = await fetch(API_BASE, { headers: headers(), cache: 'no-store' });

  if (res.status === 404) {
    // File doesn't exist yet — that's fine, we'll create it on first save
    currentSha = null;
    return null;
  }

  if (!res.ok) {
    throw new Error(`GitHub fetch error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  currentSha = json.sha; // Remember SHA for updates
  return JSON.parse(decodeBase64Utf8(json.content));
}

/**
 * Save all data to GitHub.
 * @param {{ students: Array, staff: Array, attendance: Object }} data
 * @param {{ keepalive?: boolean, retry?: boolean }} [options]
 */
export async function saveDataToGitHub(data, { keepalive = false, retry = true } = {}) {
  if (!isGitHubSyncEnabled()) return;

  const body = {
    message: `Auto-sync: ${new Date().toLocaleString('nl-BE')}`,
    content: encodeBase64Utf8(JSON.stringify(data, null, 2)),
  };

  // If the file already exists, we need to provide the SHA
  if (currentSha) body.sha = currentSha;

  const payload = JSON.stringify(body);
  const res = await fetch(API_BASE, {
    method: 'PUT',
    headers: headers(),
    body: payload,
    // keepalive lets the request finish when the app is closed (limited to ~64KB)
    keepalive: keepalive && payload.length < 60000,
  });

  if (!res.ok) {
    const errorText = await res.text();
    // SHA conflict (file changed elsewhere / unknown sha): refresh SHA and retry once
    if (retry && (res.status === 409 || res.status === 422)) {
      await fetchDataFromGitHub().catch(() => {});
      return saveDataToGitHub(data, { keepalive, retry: false });
    }
    throw new Error(`GitHub save error ${res.status}: ${errorText}`);
  }

  const json = await res.json();
  currentSha = json.content.sha; // Update SHA for next save
}
