import clsx from 'clsx';
import {
  GraduationCap,
  Sun,
  Moon,
  Cloud,
  CloudOff,
  RefreshCw,
  CalendarCheck,
  History,
  Settings,
  CircleCheck,
  TriangleAlert,
} from 'lucide-react';
import { initials, avatarGradient } from '../lib/people';
import { greeting } from '../lib/dates';

export function Avatar({ person, size = 44, ring = false, className }) {
  return (
    <span
      className={clsx('avatar', ring && 'avatar--ring', className)}
      style={{ '--size': `${size}px`, backgroundImage: avatarGradient(person) }}
      aria-hidden="true"
    >
      {initials(person)}
    </span>
  );
}

export function ProgressRing({ value, max, size = 120, stroke = 11, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const mid = size / 2;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--ring-a)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--ring-b)' }} />
          </linearGradient>
        </defs>
        <circle className="ring__track" cx={mid} cy={mid} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring__bar"
          cx={mid}
          cy={mid}
          r={r}
          strokeWidth={stroke}
          fill="none"
          stroke="url(#ringGrad)"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${mid} ${mid})`}
          style={{ opacity: pct > 0 ? 1 : 0 }}
        />
      </svg>
      <div className="ring__center">{children}</div>
    </div>
  );
}

const SYNC_META = {
  syncing: { icon: RefreshCw, label: 'Synchroniseren…' },
  synced: { icon: Cloud, label: 'Gesynchroniseerd' },
  error: { icon: CloudOff, label: 'Sync mislukt – tik om opnieuw te proberen' },
};

export function Header({ syncStatus, onSync, resolvedTheme, onToggleTheme }) {
  const meta = SYNC_META[syncStatus];
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand__logo">
          <GraduationCap size={22} strokeWidth={2.2} />
        </div>
        <div className="brand__text">
          <p className="eyebrow">{greeting()}</p>
          <h1 className="brand__title">Huiswerkklas</h1>
        </div>
      </div>
      <div className="header-actions">
        {meta && (
          <button
            id="syncBtn"
            type="button"
            className={clsx('icon-btn sync-btn', `is-${syncStatus}`)}
            onClick={onSync}
            aria-label={meta.label}
            title={meta.label}
          >
            <meta.icon size={18} />
            <span className="sync-btn__dot" />
          </button>
        )}
        <button
          id="themeToggle"
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Licht thema' : 'Donker thema'}
        >
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

const NAV_ITEMS = [
  { id: 'today', label: 'Vandaag', icon: CalendarCheck },
  { id: 'history', label: 'Historiek', icon: History },
  { id: 'settings', label: 'Meer', icon: Settings },
];

export function BottomNav({ tab, onChange }) {
  const index = NAV_ITEMS.findIndex((i) => i.id === tab);
  return (
    <nav className="bottom-nav" style={{ '--active': index }} aria-label="Hoofdnavigatie">
      <span className="bottom-nav__indicator" aria-hidden="true" />
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          id={`nav-${id}`}
          type="button"
          className={clsx('nav-item', tab === id && 'is-active')}
          onClick={() => onChange(id)}
          aria-current={tab === id ? 'page' : undefined}
        >
          <Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Toast({ toast, onClose }) {
  return (
    <div className="toast-region" aria-live="polite">
      {toast && (
        <div key={toast.id} className={clsx('toast', `toast--${toast.tone}`)} role="status">
          <span className="toast__icon">
            {toast.tone === 'warning' || toast.tone === 'error' ? <TriangleAlert size={18} /> : <CircleCheck size={18} />}
          </span>
          <span className="toast__msg">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                toast.action.onClick();
                onClose();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon size={28} />
      </div>
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
      {action}
    </div>
  );
}
