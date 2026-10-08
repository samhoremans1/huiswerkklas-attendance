import { useMemo, useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Share2,
  Search,
  X,
  Check,
  Ellipsis,
  Backpack,
  Briefcase,
  RotateCcw,
  CheckCheck,
  UserPlus,
  SearchX,
  Download,
} from 'lucide-react';
import { Avatar, ProgressRing, EmptyState } from './ui';
import { fmt, addDays, relativeDay, capitalize } from '../lib/dates';
import { byName, normalizeSearch, TYPE_LABEL } from '../lib/people';

const FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'present', label: 'Aanwezig' },
  { id: 'absent', label: 'Afwezig' },
];

function DateNav({ dateKey, todayKey, onChange }) {
  const rel = relativeDay(dateKey, todayKey);
  const isToday = dateKey === todayKey;
  return (
    <div className="date-nav">
      <button
        id="prevDayBtn"
        type="button"
        className="icon-btn icon-btn--glass"
        onClick={() => onChange(addDays(dateKey, -1))}
        aria-label="Vorige dag"
      >
        <ChevronLeft size={20} />
      </button>
      <label className="date-nav__label">
        <span className="date-nav__rel">{rel ?? capitalize(fmt(dateKey, { weekday: 'long' }))}</span>
        <span className="date-nav__date">
          {rel
            ? fmt(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })
            : fmt(dateKey, { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <input
          id="datePicker"
          type="date"
          value={dateKey}
          max={todayKey}
          onChange={(e) => e.target.value && onChange(e.target.value > todayKey ? todayKey : e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              /* native picker opens anyway */
            }
          }}
          aria-label="Kies een datum"
        />
      </label>
      <button
        id="nextDayBtn"
        type="button"
        className="icon-btn icon-btn--glass"
        onClick={() => onChange(addDays(dateKey, 1))}
        disabled={isToday || dateKey > todayKey}
        aria-label="Volgende dag"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function StatRow({ label, icon: Icon, value, total, tone }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className={clsx('stat-row', `stat-row--${tone}`)}>
      <div className="stat-row__top">
        <span className="stat-row__label">
          <Icon size={14} /> {label}
        </span>
        <span className="stat-row__value">
          <strong key={value} className="pop">{value}</strong>
          <span>/{total}</span>
        </span>
      </div>
      <div className="bar">
        <span className="bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function TodayView({
  db,
  dateKey,
  todayKey,
  onDateChange,
  segment,
  onSegmentChange,
  onToggle,
  onBulk,
  onOpenPerson,
  onAdd,
  onSendReport,
  onShare,
  install,
  onInstall,
  onDismissInstall,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setQuery('');
    setFilter('all');
  }, [segment]);

  const presentSet = useMemo(() => new Set(db.attendance[dateKey] || []), [db.attendance, dateKey]);
  const kidsPresent = useMemo(() => db.students.filter((s) => presentSet.has(s.id)).length, [db.students, presentSet]);
  const staffPresent = useMemo(() => db.staff.filter((s) => presentSet.has(s.id)).length, [db.staff, presentSet]);
  const totalPeople = db.students.length + db.staff.length;

  const list = segment === 'students' ? db.students : db.staff;
  const sorted = useMemo(() => [...list].sort(byName), [list]);

  const searched = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return sorted;
    return sorted.filter((p) => normalizeSearch(`${p.firstName} ${p.lastName} ${p.extraInfo}`).includes(q));
  }, [sorted, query]);

  const counts = useMemo(() => {
    const present = searched.filter((p) => presentSet.has(p.id)).length;
    return { all: searched.length, present, absent: searched.length - present };
  }, [searched, presentSet]);

  const visible = useMemo(() => {
    if (filter === 'present') return searched.filter((p) => presentSet.has(p.id));
    if (filter === 'absent') return searched.filter((p) => !presentSet.has(p.id));
    return searched;
  }, [searched, filter, presentSet]);

  const allVisiblePresent = visible.length > 0 && visible.every((p) => presentSet.has(p.id));
  const labels = TYPE_LABEL[segment];

  return (
    <div className="view view--today">
      {install.canInstall && !install.dismissed && (
        <div className="install-card">
          <div className="install-card__icon">
            <Download size={18} />
          </div>
          <div className="install-card__text">
            <strong>Installeer de app</strong>
            <span>Snel openen vanaf je beginscherm</span>
          </div>
          <button id="installBtn" type="button" className="btn btn--primary btn--sm" onClick={onInstall}>
            Installeren
          </button>
          <button type="button" className="icon-btn icon-btn--sm" onClick={onDismissInstall} aria-label="Verbergen">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="hero" aria-label="Overzicht van de dag">
        <div className="hero__glow" aria-hidden="true" />
        <DateNav dateKey={dateKey} todayKey={todayKey} onChange={onDateChange} />

        {dateKey !== todayKey && (
          <button id="backToTodayBtn" type="button" className="pill-btn" onClick={() => onDateChange(todayKey)}>
            <RotateCcw size={14} /> Terug naar vandaag
          </button>
        )}

        <div className="hero__stats">
          <ProgressRing value={kidsPresent + staffPresent} max={totalPeople}>
            <span key={kidsPresent + staffPresent} className="ring__value pop">{kidsPresent + staffPresent}</span>
            <span className="ring__label">aanwezig</span>
          </ProgressRing>
          <div className="hero__rows">
            <StatRow label="Kinderen" icon={Backpack} value={kidsPresent} total={db.students.length} tone="kids" />
            <StatRow label="Medewerkers" icon={Briefcase} value={staffPresent} total={db.staff.length} tone="staff" />
          </div>
        </div>

        <div className="hero__actions">
          <button id="sendReportBtn" type="button" className="btn btn--primary btn--block" onClick={onSendReport}>
            <Mail size={18} /> Rapport mailen
          </button>
          <button id="shareReportBtn" type="button" className="btn btn--glass btn--square" onClick={onShare} aria-label="Rapport delen">
            <Share2 size={18} />
          </button>
        </div>
      </section>

      <div className="toolbar">
        <div className="segmented" style={{ '--active': segment === 'students' ? 0 : 1 }} role="tablist">
          <span className="segmented__indicator" aria-hidden="true" />
          <button
            id="tab-students"
            type="button"
            role="tab"
            aria-selected={segment === 'students'}
            className={clsx('segmented__btn', segment === 'students' && 'is-active')}
            onClick={() => onSegmentChange('students')}
          >
            <Backpack size={16} /> Kinderen
            <span className="segmented__count">{db.students.length}</span>
          </button>
          <button
            id="tab-staff"
            type="button"
            role="tab"
            aria-selected={segment === 'staff'}
            className={clsx('segmented__btn', segment === 'staff' && 'is-active')}
            onClick={() => onSegmentChange('staff')}
          >
            <Briefcase size={16} /> Medewerkers
            <span className="segmented__count">{db.staff.length}</span>
          </button>
        </div>

        {list.length > 0 && (
          <>
            <div className="search">
              <Search size={18} className="search__icon" />
              <input
                id="searchInput"
                type="search"
                placeholder={segment === 'students' ? 'Zoek op naam of klas…' : 'Zoek op naam of functie…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
              />
              {query && (
                <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label="Wissen">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="chips" role="group" aria-label="Filter">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  id={`filter-${f.id}`}
                  type="button"
                  className={clsx('chip', filter === f.id && 'is-active')}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="chip__count">{counts[f.id]}</span>
                </button>
              ))}
              {visible.length > 0 && (
                <button
                  id="bulkBtn"
                  type="button"
                  className="chip chip--ghost"
                  onClick={() => onBulk(visible.map((p) => p.id), !allVisiblePresent)}
                >
                  {allVisiblePresent ? <X size={14} /> : <CheckCheck size={14} />}
                  {allVisiblePresent ? 'Niemand' : 'Iedereen'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={segment === 'students' ? Backpack : Briefcase}
          title={`Nog geen ${labels.many.toLowerCase()}`}
          text={`Voeg ${segment === 'students' ? 'je eerste kind' : 'je eerste medewerker'} toe om aanwezigheden te registreren.`}
          action={
            <button type="button" className="btn btn--primary" onClick={() => onAdd(segment)}>
              <UserPlus size={18} /> {labels.one} toevoegen
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Geen resultaten"
          text={query ? `Niemand gevonden voor “${query}”.` : 'Niemand in deze selectie.'}
        />
      ) : (
        <ul className="people" key={`${segment}-${filter}`}>
          {visible.map((p, i) => {
            const present = presentSet.has(p.id);
            return (
              <li key={p.id} className={clsx('person', present && 'is-present')} style={{ '--i': Math.min(i, 14) }}>
                <button
                  type="button"
                  className="person__main"
                  onClick={() => onToggle(p.id)}
                  aria-pressed={present}
                  aria-label={`${p.firstName} ${p.lastName}: ${present ? 'aanwezig' : 'afwezig'}`}
                >
                  <Avatar person={p} ring={present} />
                  <span className="person__text">
                    <span className="person__name">
                      {p.firstName} <span className="person__last">{p.lastName}</span>
                    </span>
                    <span className="person__meta">
                      {p.extraInfo ? <span className="tag">{p.extraInfo}</span> : <span className="muted">Geen {labels.extra.toLowerCase()}</span>}
                      {present && <span className="person__status">Aanwezig</span>}
                    </span>
                  </span>
                  <span className="check" aria-hidden="true">
                    <Check size={18} strokeWidth={3} />
                  </span>
                </button>
                <button
                  type="button"
                  className="person__more"
                  onClick={() => onOpenPerson(p.id, segment)}
                  aria-label={`Details van ${p.firstName}`}
                >
                  <Ellipsis size={20} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
