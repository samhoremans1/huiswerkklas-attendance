// GitHub Sync Module
// Reads and writes app data (students, staff, attendance) to a JSON file in a GitHub repo.

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

/**
 * Fetch all data from GitHub.
 * Returns { students, staff, attendance } or null if no data exists yet.
 */
export async function fetchDataFromGitHub() {
  if (!TOKEN || !REPO) {
    console.warn('GitHub sync not configured (missing VITE_GITHUB_TOKEN or VITE_GITHUB_REPO)');
    return null;
  }

  try {
    const res = await fetch(API_BASE, { headers: headers() });

    if (res.status === 404) {
      // File doesn't exist yet — that's fine, we'll create it on first save
      currentSha = null;
      return null;
    }

    if (!res.ok) {
      console.error('GitHub fetch error:', res.status, await res.text());
      return null;
    }

    const json = await res.json();
    currentSha = json.sha; // Remember SHA for updates
    const content = atob(json.content); // Decode base64
    return JSON.parse(content);
  } catch (err) {
    console.error('GitHub sync fetch error:', err);
    return null;
  }
}

/**
 * Save all data to GitHub.
 * @param {{ students: Array, staff: Array, attendance: Object }} data
 */
export async function saveDataToGitHub(data) {
  if (!TOKEN || !REPO) return;

  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))); // Encode to base64 (supports Unicode)

    const body = {
      message: `Auto-sync: ${new Date().toLocaleString('nl-NL')}`,
      content,
    };

    // If the file already exists, we need to provide the SHA
    if (currentSha) {
      body.sha = currentSha;
    }

    const res = await fetch(API_BASE, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      // If SHA conflict (someone else updated), re-fetch and retry once
      if (res.status === 409 || errorText.includes('sha')) {
        console.warn('SHA conflict, re-fetching...');
        await fetchDataFromGitHub(); // This updates currentSha
        return saveDataToGitHub(data); // Retry with new SHA
      }
      console.error('GitHub save error:', res.status, errorText);
      return;
    }

    const json = await res.json();
    currentSha = json.content.sha; // Update SHA for next save
    console.log('✅ Data synced to GitHub');
  } catch (err) {
    console.error('GitHub sync save error:', err);
  }
}

/**
 * Check if GitHub sync is configured.
 */
export function isGitHubSyncEnabled() {
  return !!(TOKEN && REPO);
}
