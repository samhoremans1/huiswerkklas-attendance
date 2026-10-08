// Person helpers: names, initials, avatar colours, search, sorting.

export const CLASSES = [
  '1ste Leerjaar',
  '2de Leerjaar',
  '3de Leerjaar',
  '4de Leerjaar',
  '5de Leerjaar',
  '6de Leerjaar',
];

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

/** Lowercase + strip accents so "zoe" matches "Zoë". */
export const normalizeSearch = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const newId = () => `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
