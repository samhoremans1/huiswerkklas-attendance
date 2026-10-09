// Central data store: localStorage persistence + (optional) GitHub sync.
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchDataFromGitHub, saveDataToGitHub, isGitHubSyncEnabled } from '../github-sync';
import { newId } from '../lib/people';
import { toKey } from '../lib/dates';

// Same keys as the previous version so existing data on the device is kept.
const KEYS = {
  STUDENTS: 'hwk_students',
  STAFF: 'hwk_staff',
  ATTENDANCE: 'hwk_attendance',
  SETTINGS: 'hwk_settings',
  DIRTY: 'hwk_dirty', // set while local changes haven't reached GitHub yet
};

const SYNC = isGitHubSyncEnabled();
const SAVE_DELAY = 1200;
const PULL_THROTTLE = 30_000;

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

// Repairs names that were double-encoded by the old sync code (e.g. "ZoÃ«" -> "Zoë").
const fixMojibake = (s) => {
  let out = s;
  for (let i = 0; i < 2 && /[ÃÂ][\u0080-\u00BF]/.test(out); i++) {
    if ([...out].some((c) => c.charCodeAt(0) > 255)) break;
    try {
      out = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(out, (c) => c.charCodeAt(0)));
    } catch {
      break;
    }
  }
  return out;
};

const cleanText = (v) => fixMojibake(String(v ?? '').trim());

export function normalizeDb(raw = {}) {
  const people = (arr) =>
    Array.isArray(arr)
      ? arr
          .filter((p) => p && p.id != null)
          .map((p) => {
            const out = {
              ...p,
              id: String(p.id),
              firstName: cleanText(p.firstName),
              lastName: cleanText(p.lastName),
              extraInfo: cleanText(p.extraInfo),
            };
            // Only store archive info for archived people (keeps data.json small).
            if (out.archived) out.archived = true;
            else {
              delete out.archived;
              delete out.archivedAt;
            }
            return out;
          })
      : [];

  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const settings = {
    reportRecipient: cleanText(s.reportRecipient),
    lastSchoolYear: cleanText(s.lastSchoolYear),
  };

  const attendance = {};
  if (raw.attendance && typeof raw.attendance === 'object') {
    Object.keys(raw.attendance)
      .sort()
      .forEach((date) => {
        const ids = raw.attendance[date];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(ids)) return;
        const uniq = [...new Set(ids.map(String))];
        if (uniq.length) attendance[date] = uniq;
      });
  }

  return { students: people(raw.students), staff: people(raw.staff), attendance, settings };
}

export const isValidBackup = (data) =>
  !!data && Array.isArray(data.students) && Array.isArray(data.staff) && typeof data.attendance === 'object';

export function useAppData() {
  const [db, setDb] = useState(() =>
    normalizeDb({
      students: readJSON(KEYS.STUDENTS, []),
      staff: readJSON(KEYS.STAFF, []),
      attendance: readJSON(KEYS.ATTENDANCE, {}),
      settings: readJSON(KEYS.SETTINGS, {}),
    }),
  );
  const [syncStatus, setSyncStatus] = useState(SYNC ? 'syncing' : 'off'); // off | syncing | synced | error
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [ready, setReady] = useState(!SYNC);

  const dbRef = useRef(db);
  const lastSyncedJson = useRef(null);
  const saveTimer = useRef(null);
  const lastPull = useRef(0);

  // ---- Sync primitives ----------------------------------------------------
  const push = useCallback(async ({ keepalive = false } = {}) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const snapshot = dbRef.current;
    const json = JSON.stringify(snapshot);
    if (json === lastSyncedJson.current) {
      localStorage.removeItem(KEYS.DIRTY);
      setSyncStatus('synced');
      return;
    }
    setSyncStatus('syncing');
    try {
      await saveDataToGitHub(snapshot, { keepalive });
      lastSyncedJson.current = json;
      if (JSON.stringify(dbRef.current) === json) localStorage.removeItem(KEYS.DIRTY);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
    }
  }, []);

  const pull = useCallback(
    async ({ force = false } = {}) => {
      if (!SYNC) return;
      lastPull.current = Date.now();

      // Unsynced local edits win: push them instead of overwriting them.
      if (!force && localStorage.getItem(KEYS.DIRTY)) {
        setReady(true);
        await push();
        return;
      }

      const before = dbRef.current;
      setSyncStatus('syncing');
      try {
        const remote = await fetchDataFromGitHub();
        if (!force && dbRef.current !== before) {
          // User edited while we were loading – keep their edits.
          setReady(true);
          await push();
          return;
        }
        if (remote) {
          const next = normalizeDb(remote);
          lastSyncedJson.current = JSON.stringify(next);
          setDb(next);
        }
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
      } catch (err) {
        console.error(err);
        setSyncStatus('error');
      }
      setReady(true);
    },
    [push],
  );

  // Initial load + refresh when returning to the app, flush when leaving it.
  useEffect(() => {
    if (!SYNC) return;
    pull();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (saveTimer.current) push({ keepalive: true });
      } else if (Date.now() - lastPull.current > PULL_THROTTLE) {
        pull();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pull, push]);

  // Persist locally on every change; schedule a debounced GitHub save.
  useEffect(() => {
    dbRef.current = db;
    try {
      localStorage.setItem(KEYS.STUDENTS, JSON.stringify(db.students));
      localStorage.setItem(KEYS.STAFF, JSON.stringify(db.staff));
      localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(db.attendance));
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(db.settings));
    } catch (err) {
      console.error('localStorage error', err);
    }
    if (!SYNC || !ready) return;
    if (JSON.stringify(db) === lastSyncedJson.current) return;
    localStorage.setItem(KEYS.DIRTY, '1');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => push(), SAVE_DELAY);
  }, [db, ready, push]);

  // ---- Mutations ------------------------------------------------------------
  const togglePresence = useCallback((dateKey, id) => {
    setDb((prev) => {
      const list = prev.attendance[dateKey] || [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      const attendance = { ...prev.attendance };
      if (next.length) attendance[dateKey] = next;
      else delete attendance[dateKey];
      return { ...prev, attendance };
    });
  }, []);

  const setPresence = useCallback((dateKey, ids, present) => {
    setDb((prev) => {
      const set = new Set(prev.attendance[dateKey] || []);
      ids.forEach((id) => (present ? set.add(id) : set.delete(id)));
      const attendance = { ...prev.attendance };
      if (set.size) attendance[dateKey] = [...set];
      else delete attendance[dateKey];
      return { ...prev, attendance };
    });
  }, []);

  const addPerson = useCallback((type, values) => {
    const person = { id: newId(), since: toKey(), ...values };
    setDb((prev) => ({ ...prev, [type]: [...prev[type], person] }));
    return person;
  }, []);

  const updatePerson = useCallback((type, id, values) => {
    setDb((prev) => ({ ...prev, [type]: prev[type].map((p) => (p.id === id ? { ...p, ...values } : p)) }));
  }, []);

  const deletePerson = useCallback((type, id) => {
    setDb((prev) => {
      const attendance = {};
      Object.entries(prev.attendance).forEach(([date, ids]) => {
        const next = ids.filter((x) => x !== id);
        if (next.length) attendance[date] = next;
      });
      return { ...prev, [type]: prev[type].filter((p) => p.id !== id), attendance };
    });
  }, []);

  const setArchived = useCallback((type, id, archived) => {
    setDb((prev) => ({
      ...prev,
      [type]: prev[type].map((p) => {
        if (p.id !== id) return p;
        const { archived: _a, archivedAt: _b, ...rest } = p;
        return archived ? { ...rest, archived: true, archivedAt: toKey() } : rest;
      }),
    }));
  }, []);

  /**
   * New school year. `changes` = [{ id, to }] (new class) or [{ id, archive: true }].
   */
  const applySchoolYear = useCallback((changes, yearLabel) => {
    const byId = new Map(changes.map((c) => [c.id, c]));
    const today = toKey();
    setDb((prev) => ({
      ...prev,
      students: prev.students.map((p) => {
        const c = byId.get(p.id);
        if (!c) return p;
        if (c.archive) return { ...p, archived: true, archivedAt: today };
        return { ...p, extraInfo: c.to };
      }),
      settings: { ...prev.settings, lastSchoolYear: yearLabel },
    }));
  }, []);

  const updateSettings = useCallback((patch) => {
    setDb((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const replaceAll = useCallback((data) => setDb(normalizeDb(data)), []);

  const sync = useCallback(() => pull(), [pull]);

  return {
    db,
    syncStatus,
    lastSyncedAt,
    syncEnabled: SYNC,
    sync,
    togglePresence,
    setPresence,
    addPerson,
    updatePerson,
    deletePerson,
    setArchived,
    applySchoolYear,
    updateSettings,
    replaceAll,
  };
}
