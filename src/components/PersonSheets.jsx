import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  Backpack,
  Briefcase,
  Pencil,
  Trash2,
  Flame,
  CalendarCheck,
  Percent,
  TriangleAlert,
  Archive,
  ArchiveRestore,
  Info,
} from 'lucide-react';
import Sheet from './Sheet';
import { Avatar, ClassTag } from './ui';
import { fmt, relativeDay } from '../lib/dates';
import {
  CLASSES_BY_LEVEL,
  LEVELS,
  STAFF_ROLES,
  TYPE_LABEL,
  fullName,
  normalizeSearch,
  parseClass,
  personStats,
} from '../lib/people';

/* ------------------------------------------------------------------ */
/* Add / edit form                                                     */
/* ------------------------------------------------------------------ */

function PersonFormBody({ state, db, onSubmit, onClose }) {
  const editing = state.mode === 'edit';
  const [type, setType] = useState(state.type);
  const [firstName, setFirstName] = useState(state.person?.firstName ?? '');
  const [lastName, setLastName] = useState(state.person?.lastName ?? '');
  const [extraInfo, setExtraInfo] = useState(state.person?.extraInfo ?? '');
  const [level, setLevel] = useState(() => parseClass(state.person?.extraInfo)?.level ?? 'lager');

  const duplicate = useMemo(() => {
    const name = normalizeSearch(`${firstName} ${lastName}`);
    if (!firstName.trim() || !lastName.trim()) return null;
    return db[type].find((p) => p.id !== state.person?.id && normalizeSearch(fullName(p)) === name) ?? null;
  }, [db, type, firstName, lastName, state.person]);

  // Standard classes of the chosen level, plus an old free-text class if the person has one.
  const classOptions = useMemo(() => {
    const base = CLASSES_BY_LEVEL[level];
    return extraInfo && !parseClass(extraInfo) ? [...base, extraInfo] : base;
  }, [level, extraInfo]);

  const switchLevel = (next) => {
    if (next === level) return;
    setLevel(next);
    if (parseClass(extraInfo)) setExtraInfo(''); // selected class belongs to the other level
  };

  const submit = (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    onSubmit({
      type,
      values: { firstName: firstName.trim(), lastName: lastName.trim(), extraInfo: extraInfo.trim() },
    });
  };

  return (
    <form id="personForm" className="form" onSubmit={submit}>
      {!editing && (
        <div className="segmented" style={{ '--active': type === 'students' ? 0 : 1 }}>
          <span className="segmented__indicator" aria-hidden="true" />
          {['students', 'staff'].map((t) => (
            <button
              key={t}
              type="button"
              className={clsx('segmented__btn', type === t && 'is-active')}
              onClick={() => {
                setType(t);
                setExtraInfo('');
              }}
            >
              {t === 'students' ? <Backpack size={16} /> : <Briefcase size={16} />} {TYPE_LABEL[t].one}
            </button>
          ))}
        </div>
      )}

      <div className="field-row">
        <label className="field">
          <span className="field__label">Voornaam</span>
          <input
            id="firstNameInput"
            className="input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Bijv. Jan"
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="next"
            required
            autoFocus={!editing}
          />
        </label>
        <label className="field">
          <span className="field__label">Achternaam</span>
          <input
            id="lastNameInput"
            className="input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Bijv. Janssens"
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="done"
            required
          />
        </label>
      </div>

      {type === 'students' ? (
        <div className="field">
          <div className="field__head">
            <span className="field__label">Klas</span>
            <div
              className="segmented segmented--sm"
              style={{ '--active': level === 'lager' ? 0 : 1 }}
              role="group"
              aria-label="Niveau"
            >
              <span className={clsx('segmented__indicator', level === 'middelbaar' && 'segmented__indicator--pink')} aria-hidden="true" />
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  id={`level-${l.id}`}
                  type="button"
                  className={clsx('segmented__btn', level === l.id && 'is-active')}
                  onClick={() => switchLevel(l.id)}
                  aria-pressed={level === l.id}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div key={level} className={clsx('class-grid', `class-grid--${level}`)}>
            {classOptions.map((c) => {
              const parsed = parseClass(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={clsx('class-chip', extraInfo === c && 'is-active')}
                  onClick={() => setExtraInfo((v) => (v === c ? '' : c))}
                  aria-pressed={extraInfo === c}
                >
                  <strong>{parsed ? c.split(' ')[0] : c}</strong>
                  {parsed && <span>{LEVELS.find((l) => l.id === parsed.level).unit}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="roleInput" className="field__label">Functie / rol</label>
          <input
            id="roleInput"
            className="input"
            value={extraInfo}
            onChange={(e) => setExtraInfo(e.target.value)}
            placeholder="Bijv. Vrijwilliger"
            autoCapitalize="sentences"
            autoComplete="off"
          />
          <div className="chips chips--wrap">
            {STAFF_ROLES.map((r) => (
              <button key={r} type="button" className={clsx('chip chip--sm', extraInfo === r && 'is-active')} onClick={() => setExtraInfo(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {duplicate && (
        <p className="form-hint">
          <TriangleAlert size={15} />
          {duplicate.archived ? 'Er staat al iemand met deze naam in het archief.' : 'Er bestaat al iemand met deze naam.'}
        </p>
      )}

      <div className="sheet-actions">
        <button type="button" className="btn btn--glass" onClick={onClose}>
          Annuleren
        </button>
        <button id="savePersonBtn" type="submit" className="btn btn--primary" disabled={!firstName.trim() || !lastName.trim()}>
          {editing ? 'Opslaan' : 'Toevoegen'}
        </button>
      </div>
    </form>
  );
}

export function PersonFormSheet({ open, state, db, onSubmit, onClose }) {
  if (!state) return null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={state.mode === 'edit' ? 'Gegevens bewerken' : 'Nieuwe persoon'}
      subtitle={state.mode === 'edit' ? fullName(state.person) : 'Voeg een kind of medewerker toe'}
      labelledBy="personFormTitle"
    >
      <PersonFormBody key={state.key} state={state} db={db} onSubmit={onSubmit} onClose={onClose} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Person detail / stats                                               */
/* ------------------------------------------------------------------ */

export function PersonDetailSheet({ open, person, type, db, todayKey, onEdit, onDelete, onArchive, onRestore, onClose }) {
  const stats = useMemo(() => (person ? personStats(person, db.attendance) : null), [person, db.attendance]);

  if (!person || !stats) return null;
  const labels = TYPE_LABEL[type];
  const archived = !!person.archived;
  const shortDate = (d) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="sheet--detail"
      footer={
        archived ? (
          <div className="sheet-actions">
            <button id="deletePersonBtn" type="button" className="btn btn--danger" onClick={onDelete}>
              <Trash2 size={17} /> Verwijderen
            </button>
            <button id="restorePersonBtn" type="button" className="btn btn--primary" onClick={onRestore}>
              <ArchiveRestore size={17} /> Terugzetten
            </button>
          </div>
        ) : (
          <div className="sheet-actions">
            <button id="archivePersonBtn" type="button" className="btn btn--glass" onClick={onArchive}>
              <Archive size={17} /> Archiveren
            </button>
            <button id="editPersonBtn" type="button" className="btn btn--primary" onClick={onEdit}>
              <Pencil size={17} /> Bewerken
            </button>
          </div>
        )
      }
    >
      <div className="profile">
        <Avatar person={person} size={76} className={clsx('profile__avatar', archived && 'avatar--muted')} />
        <h3 className="profile__name">{fullName(person)}</h3>
        <div className="profile__meta">
          <span className={clsx('tag', type === 'staff' && 'tag--staff')}>
            {type === 'students' ? <Backpack size={12} /> : <Briefcase size={12} />} {labels.one}
          </span>
          {person.extraInfo && (type === 'students' ? <ClassTag person={person} /> : <span className="tag tag--muted">{person.extraInfo}</span>)}
          {archived && (
            <span className="tag tag--archived">
              <Archive size={12} /> Gearchiveerd{person.archivedAt ? ` op ${shortDate(person.archivedAt)}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="stat-tiles stat-tiles--compact">
        <div className="tile tile--violet">
          <CalendarCheck size={16} />
          <span className="tile__value">{stats.days}</span>
          <span className="tile__label">Dagen</span>
        </div>
        <div className="tile tile--cyan">
          <Percent size={16} />
          <span className="tile__value">{stats.pct == null ? '–' : `${stats.pct}%`}</span>
          <span className="tile__label">Aanwezig</span>
        </div>
        <div className="tile tile--amber">
          <Flame size={16} />
          <span className="tile__value">{stats.streak}</span>
          <span className="tile__label">Op rij</span>
        </div>
      </div>

      {stats.start && (
        <p className="stat-note">
          <Info size={13} />
          {stats.sessions} {stats.sessions === 1 ? 'sessie' : 'sessies'} sinds {shortDate(stats.start)}
          {archived && person.archivedAt ? ` tot ${shortDate(person.archivedAt)}` : ''}
        </p>
      )}

      {stats.recent.length > 0 && (
        <div className="detail-block">
          <p className="group-title">Laatste {stats.recent.length} sessies</p>
          <div className="dots-strip">
            {stats.recent.map((r) => (
              <span
                key={r.date}
                className={clsx('dot-cell', r.present && 'is-on')}
                title={`${fmt(r.date, { day: 'numeric', month: 'short' })}: ${r.present ? 'aanwezig' : 'afwezig'}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="detail-block">
        <p className="group-title">Aanwezig op</p>
        {stats.presentDays.length === 0 ? (
          <p className="muted">Nog nergens aanwezig gemeld.</p>
        ) : (
          <div className="name-tags">
            {stats.presentDays.slice(0, 40).map((d) => (
              <span key={d} className="name-tag">
                {relativeDay(d, todayKey) ?? fmt(d, { day: 'numeric', month: 'short', year: '2-digit' })}
              </span>
            ))}
            {stats.presentDays.length > 40 && <span className="name-tag name-tag--muted">+{stats.presentDays.length - 40} meer</span>}
          </div>
        )}
      </div>

      {!archived && (
        <button id="deletePersonLink" type="button" className="text-btn text-btn--danger" onClick={onDelete}>
          <Trash2 size={14} /> Definitief verwijderen
        </button>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm                                                             */
/* ------------------------------------------------------------------ */

export function ConfirmSheet({ open, state, onClose }) {
  if (!state) return null;
  return (
    <Sheet open={open} onClose={onClose} className="sheet--confirm">
      <div className="confirm">
        <div className={clsx('confirm__icon', state.tone === 'danger' && 'confirm__icon--danger')}>
          {state.icon ?? <TriangleAlert size={26} />}
        </div>
        <h3 className="confirm__title">{state.title}</h3>
        <p className="confirm__text">{state.message}</p>
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn btn--glass" onClick={onClose}>
          Annuleren
        </button>
        <button
          id="confirmBtn"
          type="button"
          className={clsx('btn', state.tone === 'danger' ? 'btn--danger-solid' : 'btn--primary')}
          onClick={() => {
            state.onConfirm();
            onClose();
          }}
        >
          {state.confirmLabel ?? 'Bevestigen'}
        </button>
      </div>
    </Sheet>
  );
}
