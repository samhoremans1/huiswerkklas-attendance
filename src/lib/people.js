// Person helpers: names, initials, avatar colours, search, sorting, school classes.
import { toKey } from './dates';

/* ------------------------------------------------------------------ */
/* School classes (lager + middelbaar)                                 */
/* The class is stored as plain text in `extraInfo` (e.g. "3de Leerjaar",
/* "2de Middelbaar") so old data and backups keep working unchanged.   */
/* ------------------------------------------------------------------ */

export const GRADES = [1, 2, 3, 4, 5, 6];

export const LEVELS = [
  { id: 'lager', label: 'Lager', unit: 'leerjaar', word: 'Leerjaar' },
  { id: 'middelbaar', label: 'Middelbaar', unit: 'middelbaar', word: 'Middelbaar' },
];

export const LEVEL_LABEL = { lager: 'Lager', middelbaar: 'Middelbaar', none: 'Geen klas' };

export const ordinal = (n) => `${n}${n === 1 ? 'ste' : 'de'}`;

export const classLabel = (level, grade) =>
  `${ordinal(grade)} ${LEVELS.find((l) => l.id === level)?.word ?? 'Leerjaar'}`;

export const CLASSES_BY_LEVEL = Object.fromEntries(LEVELS.map((l) => [l.id, GRADES.map((g) => classLabel(l.id, g))]));

export const CLASSES = LEVELS.flatMap((l) => CLASSES_BY_LEVEL[l.id]);

/** "3de Leerjaar" -> { level: 'lager', grade: 3 }; unknown text -> null. */
export function parseClass(text) {
  const m = /^\s*(\d)\s*(?:ste|de|e)?\s+(leerjaar|middelbaar)\s*$/i.exec(String(text ?? ''));
  if (!m) return null;
  const grade = Number(m[1]);
  if (grade < 1 || grade > 6) return null;
  return { level: m[2].toLowerCase() === 'middelbaar' ? 'middelbaar' : 'lager', grade };
}

/** 'lager' | 'middelbaar' | null */
export const levelOf = (person) => parseClass(person?.extraInfo)?.level ?? null;

/** What happens to a class at the start of a new school year. */
export function nextClass(text) {
  const c = parseClass(text);
  if (!c) return { kind: 'unknown' };
  if (c.grade < 6) return { kind: 'up', to: classLabel(c.level, c.grade + 1) };
  if (c.level === 'lager') return { kind: 'switch', to: classLabel('middelbaar', 1) };
  return { kind: 'leaves' };
}

/** School year label for a date key, e.g. "2026–2027" (switches in July). */
export const schoolYear = (key = toKey()) => {
  const [y, m] = key.split('-').map(Number);
  const start = m >= 7 ? y : y - 1;
  return `${start}–${start + 1}`;
};

/* ------------------------------------------------------------------ */
/* Generic person helpers                                              */
/* ------------------------------------------------------------------ */

export const STAFF_ROLES = ['Vrijwilliger', 'Begeleider', 'Coördinator', 'Stagiair'];

export const TYPE_LABEL = {
  students: { one: 'Kind', many: 'Kinderen', extra: 'Klas' },
  staff: { one: 'Medewerker', many: 'Medewerkers', extra: 'Functie' },
};

const GRADIENTS = [
  ['#a78bfa', '#6366f1'],
  ['#f472b6', '#e11d48'],
  ['#22d3ee', '#3b82f6'],
  ['#34d399', '#0d9488'],
  ['#fbbf24', '#f97316'],
  ['#c084fc', '#db2777'],
  ['#60a5fa', '#7c3aed'],
  ['#2dd4bf', '#16a34a'],
  ['#fb7185', '#f59e0b'],
];

export const fullName = (p) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();

export const initials = (p) =>
  `${(p.firstName || '').trim().charAt(0)}${(p.lastName || '').trim().charAt(0)}`.toUpperCase() || '?';

export const avatarGradient = (p) => {
  let h = 0;
  for (const c of String(p.id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
};

export const byName = (a, b) =>
  fullName(a).localeCompare(fullName(b), 'nl', { sensitivity: 'base' });

const LEVEL_ORDER = { lager: 0, middelbaar: 1 };

/** Lager before middelbaar, then by grade, then by name. Unknown classes last. */
export const byClass = (a, b) => {
  const ca = parseClass(a.extraInfo);
  const cb = parseClass(b.extraInfo);
  const la = ca ? LEVEL_ORDER[ca.level] : 2;
  const lb = cb ? LEVEL_ORDER[cb.level] : 2;
  return la - lb || (ca?.grade ?? 0) - (cb?.grade ?? 0) || byName(a, b);
};

/** Groups students per level: [{ id, label, people }], empty groups left out. */
export function groupByLevel(list) {
  const groups = { lager: [], middelbaar: [], none: [] };
  list.forEach((p) => groups[levelOf(p) ?? 'none'].push(p));
  return ['lager', 'middelbaar', 'none']
    .filter((id) => groups[id].length)
    .map((id) => ({ id, label: LEVEL_LABEL[id], people: groups[id].sort(byClass) }));
}

/** Lowercase + strip accents so "zoe" matches "Zoë". */
export const normalizeSearch = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const newId = () => `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

/**
 * Day the person was added. Uses `since` when present; older records get it
 * from their id, which starts with the Date.now() timestamp of creation.
 */
export function joinedOn(person) {
  if (person?.since) return person.since;
  const m = /^(\d{13})/.exec(String(person?.id ?? ''));
  if (!m) return null;
  const t = Number(m[1]);
  if (t < Date.UTC(2015, 0, 1) || t > Date.now() + 86400000) return null;
  return toKey(new Date(t));
}

/**
 * Fair attendance stats: only sessions from the person's start
 * (earliest of "added on" and first presence) until archiving count.
 */
export function personStats(person, attendance) {
  const all = Object.keys(attendance)
    .filter((d) => attendance[d]?.length)
    .sort();
  const isPresent = (d) => attendance[d].includes(person.id);
  const firstPresent = all.find(isPresent) ?? null;
  const start = [joinedOn(person), firstPresent].filter(Boolean).sort()[0] ?? null;
  const end = person.archived ? person.archivedAt ?? null : null;

  const sessions = start ? all.filter((d) => d >= start && (!end || d <= end)) : [];
  const presentDays = all.filter(isPresent).reverse(); // newest first, all time
  const presentInRange = sessions.filter(isPresent).length;

  let streak = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (isPresent(sessions[i])) streak++;
    else break;
  }

  return {
    start,
    sessions: sessions.length,
    days: presentDays.length,
    pct: sessions.length ? Math.round((presentInRange / sessions.length) * 100) : null,
    streak,
    presentDays,
    recent: sessions.slice(-14).map((d) => ({ date: d, present: isPresent(d) })),
  };
}
