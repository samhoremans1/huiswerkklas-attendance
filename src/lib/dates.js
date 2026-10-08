// Date helpers. All attendance keys are local-time "YYYY-MM-DD" strings.
// We never use `new Date("YYYY-MM-DD")` because that parses as UTC and can shift the day.

export const LOCALE = 'nl-BE';

const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key, n) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

export const fmt = (key, opts) => fromKey(key).toLocaleDateString(LOCALE, opts);

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const greeting = (h = new Date().getHours()) => {
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
};

/** Returns "Vandaag" / "Gisteren" / null relative to todayKey. */
export const relativeDay = (key, todayKey) => {
  const diff = Math.round((fromKey(todayKey) - fromKey(key)) / 86400000);
  if (diff === 0) return 'Vandaag';
  if (diff === 1) return 'Gisteren';
  return null;
};

export const monthKey = (key) => key.slice(0, 7);

export const prevMonthKey = (todayKey) => {
  const d = fromKey(todayKey);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return toKey(d).slice(0, 7);
};

export const formatTime = (date) =>
  date ? date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) : '';
