// Report builders: plain-text day report (mail / share) and Word (.doc) report.
import { fmt, toKey, monthKey, prevMonthKey } from './dates';
import { fullName, byName, byClass, groupByLevel, levelOf, LEVEL_LABEL } from './people';

/** Used when no recipient is set in the settings. */
export const REPORT_RECIPIENT = 'samhoremans1@gmail.com';

/** Splits "a@x.be, b@y.be" into a clean list. */
export const parseRecipients = (s) =>
  String(s ?? '')
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const reportRecipient = (db) => {
  const list = parseRecipients(db.settings?.reportRecipient).filter(isValidEmail);
  return list.length ? list.join(',') : REPORT_RECIPIENT;
};

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function getPresent(db, dateKey) {
  const set = new Set(db.attendance[dateKey] || []);
  return {
    kids: db.students.filter((s) => set.has(s.id)).sort(byClass),
    staff: db.staff.filter((s) => set.has(s.id)).sort(byName),
  };
}

export function buildDayReport(db, dateKey) {
  const { kids, staff } = getPresent(db, dateKey);
  const dateStr = fmt(dateKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const kidLine = (k) => `- ${fullName(k)} [${k.extraInfo || 'Geen klas'}]\n`;

  let text = `Aanwezigheidsrapportage - ${dateStr}\n\n`;
  text += `--- KINDEREN (${kids.length}) ---\n`;
  const groups = groupByLevel(kids);
  if (groups.some((g) => g.id === 'middelbaar')) {
    groups.forEach((g, i) => {
      text += `${i ? '\n' : ''}${g.label} (${g.people.length})\n`;
      g.people.forEach((k) => (text += kidLine(k)));
    });
  } else {
    kids.forEach((k) => (text += kidLine(k)));
  }
  text += `\n--- MEDEWERKERS (${staff.length}) ---\n`;
  staff.forEach((s) => (text += `- ${fullName(s)} [${s.extraInfo || 'Geen functie'}]\n`));

  return {
    text,
    subject: `Aanwezigheid Huiswerkklas - ${dateStr}`,
    count: kids.length + staff.length,
  };
}

export const REPORT_PERIODS = [
  { id: 'month', label: 'Deze maand' },
  { id: 'prev', label: 'Vorige maand' },
  { id: 'all', label: 'Alles' },
];

function datesForPeriod(db, period) {
  const today = toKey();
  const filter =
    period === 'month' ? (d) => monthKey(d) === monthKey(today)
    : period === 'prev' ? (d) => monthKey(d) === prevMonthKey(today)
    : () => true;
  return Object.keys(db.attendance)
    .filter((d) => filter(d) && (db.attendance[d] || []).length > 0)
    .sort();
}

/** Returns a Blob for a Word-compatible report, or null when there is no data. */
export function buildWordReport(db, period = 'all') {
  const dates = datesForPeriod(db, period);
  if (dates.length === 0) return null;

  const periodLabel = REPORT_PERIODS.find((p) => p.id === period)?.label ?? 'Alles';
  const now = new Date();
  const title = `Aanwezigheidsrapport Huiswerkklas - ${now.toLocaleDateString('nl-BE')}`;

  // Totals per person within the period
  const counts = new Map();
  dates.forEach((d) => db.attendance[d].forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
  const kidType = (p) => (levelOf(p) ? `Kind · ${LEVEL_LABEL[levelOf(p)]}` : 'Kind');
  const nameCell = (p) => `${escapeHtml(fullName(p))}${p.archived ? ' <span class="type-tag">(gearchiveerd)</span>' : ''}`;
  const summaryRows = (list, typeOf, sort) =>
    [...list]
      .filter((p) => counts.get(p.id))
      .sort(sort)
      .map(
        (p) => `<tr><td>${nameCell(p)}</td><td><span class="type-tag">${typeOf(p)}</span></td><td>${escapeHtml(p.extraInfo || '-')}</td><td class="num">${counts.get(p.id)}</td></tr>`,
      )
      .join('');

  // Unique children per level in this period
  const kidsInPeriod = db.students.filter((p) => counts.get(p.id));
  const perLevel = groupByLevel(kidsInPeriod)
    .map((g) => `${g.label.toLowerCase()}: ${g.people.length}`)
    .join(', ');

  let detailRows = '';
  dates.forEach((date) => {
    const { kids, staff } = getPresent(db, date);
    const people = [...kids.map((p) => [p, kidType(p)]), ...staff.map((p) => [p, 'Medewerker'])];
    const readable = fmt(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    people.forEach(([p, type], i) => {
      detailRows += `<tr>
        <td>${i === 0 ? `<strong>${escapeHtml(readable)}</strong>` : ''}</td>
        <td><span class="type-tag">${type}</span></td>
        <td>${escapeHtml(fullName(p))}</td>
        <td>${escapeHtml(p.extraInfo || '-')}</td>
      </tr>`;
    });
  });

  const html = `
  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>${escapeHtml(title)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; }
    h1 { color: #6d28d9; border-bottom: 2px solid #6d28d9; padding-bottom: 8px; }
    h2 { color: #4338ca; margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background-color: #f3f4f6; text-align: left; padding: 10px; border: 1px solid #e5e7eb; }
    td { padding: 8px 10px; border: 1px solid #e5e7eb; font-size: 11pt; }
    td.num { text-align: right; font-weight: bold; }
    .type-tag { font-size: 9pt; color: #6b7280; }
    .meta { color: #6b7280; }
  </style></head>
  <body>
    <h1>Aanwezigheidsoverzicht Huiswerkklas</h1>
    <p class="meta">Periode: <strong>${periodLabel}</strong> &middot; ${dates.length} sessies &middot; Gegenereerd op ${escapeHtml(now.toLocaleString('nl-BE'))}</p>
    <p class="meta">${kidsInPeriod.length} verschillende kinderen${perLevel ? ` (${escapeHtml(perLevel)})` : ''}</p>

    <h2>Overzicht per persoon</h2>
    <table>
      <thead><tr><th>Naam</th><th>Type</th><th>Klas / Functie</th><th>Dagen aanwezig</th></tr></thead>
      <tbody>${summaryRows(db.students, kidType, byClass)}${summaryRows(db.staff, () => 'Medewerker', byName)}</tbody>
    </table>

    <h2>Detail per dag</h2>
    <table>
      <thead><tr><th>Datum</th><th>Type</th><th>Naam</th><th>Klas / Functie</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>
  </body></html>`;

  return new Blob(['\ufeff', html], { type: 'application/msword' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
