import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Backpack, Briefcase, Pencil, Trash2, Flame, CalendarCheck, Percent, TriangleAlert } from 'lucide-react';
import Sheet from './Sheet';
import { Avatar } from './ui';
import { fmt, relativeDay } from '../lib/dates';
import { CLASSES, STAFF_ROLES, TYPE_LABEL, fullName, normalizeSearch } from '../lib/people';

/* ------------------------------------------------------------------ */
/* Add / edit form                                                     */
/* ------------------------------------------------------------------ */

function PersonFormBody({ state, db, onSubmit, onClose }) {
  const editing = state.mode === 'edit';
  const [type, setType] = useState(state.type);
  const [firstName, setFirstName] = useState(state.person?.firstName ?? '');
  const [lastName, setLastName] = useState(state.person?.lastName ?? '');
  const [extraInfo, setExtraInfo] = useState(state.person?.extraInfo ?? '');

  const duplicate = useMemo(() => {
    const name = normalizeSearch(`${firstName} ${lastName}`);
    if (!firstName.trim() || !lastName.trim()) return false;
    return db[type].some((p) => p.id !== state.person?.id && normalizeSearch(fullName(p)) === name);
  }, [db, type, firstName, lastName, state.person]);

  const classOptions = useMemo(
    () => (extraInfo && type === 'students' && !CLASSES.includes(extraInfo) ? [...CLASSES, extraInfo] : CLASSES),
    [extraInfo, type],
  );

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
          <span className="field__label">Klas</span>
          <div className="class-grid">
            {classOptions.map((c) => (
              <button
                key={c}
                type="button"
                className={clsx('class-chip', extraInfo === c && 'is-active')}
                onClick={() => setExtraInfo((v) => (v === c ? '' : c))}
                aria-pressed={extraInfo === c}
              >
                <strong>{c.split(' ')[0]}</strong>
                {CLASSES.includes(c) && <span>leerjaar</span>}
              </button>
            ))}
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
          <TriangleAlert size={15} /> Er bestaat al iemand met deze naam.
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

export function PersonDetailSheet({ open, person, type, db, todayKey, onEdit, onDelete, onClose }) {
  const stats = useMemo(() => {
    if (!person) return null;
    const sessionDays = Object.keys(db.attendance)
      .filter((d) => db.attendance[d].length > 0)
      .sort((a, b) => b.localeCompare(a));
    const presentDays = sessionDays.filter((d) => db.attendance[d].includes(person.id));
    let streak = 0;
    for (const d of sessionDays) {
      if (db.attendance[d].includes(person.id)) streak++;
      else break;
    }
    const recent = sessionDays.slice(0, 14).reverse().map((d) => ({ date: d, present: db.attendance[d].includes(person.id) }));
    return {
      days: presentDays.length,
      pct: sessionDays.length ? Math.round((presentDays.length / sessionDays.length) * 100) : 0,
      streak,
      presentDays,
      recent,
    };
  }, [person, db.attendance]);

  if (!person || !stats) return null;
  const labels = TYPE_LABEL[type];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="sheet--detail"
      footer={
        <div className="sheet-actions">
          <button id="deletePersonBtn" type="button" className="btn btn--danger" onClick={onDelete}>
            <Trash2 size={17} /> Verwijderen
          </button>
          <button id="editPersonBtn" type="button" className="btn btn--primary" onClick={onEdit}>
            <Pencil size={17} /> Bewerken
          </button>
        </div>
      }
    >
      <div className="profile">
        <Avatar person={person} size={76} className="profile__avatar" />
        <h3 className="profile__name">{fullName(person)}</h3>
        <div className="profile__meta">
          <span className={clsx('tag', type === 'staff' && 'tag--staff')}>
            {type === 'students' ? <Backpack size={12} /> : <Briefcase size={12} />} {labels.one}
          </span>
          {person.extraInfo && <span className="tag tag--muted">{person.extraInfo}</span>}
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
          <span className="tile__value">{stats.pct}%</span>
          <span className="tile__label">Aanwezig</span>
        </div>
        <div className="tile tile--amber">
          <Flame size={16} />
          <span className="tile__value">{stats.streak}</span>
          <span className="tile__label">Op rij</span>
        </div>
      </div>

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
