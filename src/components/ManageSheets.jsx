import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, ArchiveRestore, Archive, TrendingUp, GraduationCap, DoorOpen, TriangleAlert, Backpack, Briefcase } from 'lucide-react';
import Sheet from './Sheet';
import { Avatar, ClassTag, EmptyState } from './ui';
import { fmt } from '../lib/dates';
import { byClass, byName, fullName, nextClass, schoolYear } from '../lib/people';

/* ------------------------------------------------------------------ */
/* New school year                                                     */
/* ------------------------------------------------------------------ */

function ChangeRow({ person, to, note }) {
  return (
    <li className="change-row">
      <Avatar person={person} size={34} />
      <span className="change-row__text">
        <span className="change-row__name">{fullName(person)}</span>
        <span className="change-row__classes">
          <ClassTag person={person} />
          {to && (
            <>
              <ArrowRight size={13} className="change-row__arrow" />
              <ClassTag person={{ extraInfo: to }} />
            </>
          )}
          {note && <span className="muted">{note}</span>}
        </span>
      </span>
    </li>
  );
}

function SchoolYearBody({ db, todayKey, onApply, onClose }) {
  const year = schoolYear(todayKey);
  const alreadyDone = db.settings?.lastSchoolYear === year;
  const [archiveLeavers, setArchiveLeavers] = useState(true);

  const plan = useMemo(() => {
    const groups = { up: [], switching: [], leaving: [], unknown: [] };
    db.students
      .filter((p) => !p.archived)
      .sort(byClass)
      .forEach((person) => {
        const next = nextClass(person.extraInfo);
        if (next.kind === 'up') groups.up.push({ person, to: next.to });
        else if (next.kind === 'switch') groups.switching.push({ person, to: next.to });
        else if (next.kind === 'leaves') groups.leaving.push({ person });
        else groups.unknown.push({ person });
      });
    return groups;
  }, [db.students]);

  const changes = [
    ...[...plan.up, ...plan.switching].map(({ person, to }) => ({ id: person.id, to })),
    ...(archiveLeavers ? plan.leaving.map(({ person }) => ({ id: person.id, archive: true })) : []),
  ];

  return (
    <div className="school-year">
      {alreadyDone && (
        <p className="form-hint">
          <TriangleAlert size={15} /> Je deed dit al voor schooljaar {year}. Nog eens bevestigen zet iedereen nóg een jaar hoger.
        </p>
      )}

      <div className="stat-tiles stat-tiles--compact">
        <div className="tile tile--violet">
          <TrendingUp size={16} />
          <span className="tile__value">{plan.up.length}</span>
          <span className="tile__label">Jaar hoger</span>
        </div>
        <div className="tile tile--pink">
          <GraduationCap size={16} />
          <span className="tile__value">{plan.switching.length}</span>
          <span className="tile__label">Naar middelbaar</span>
        </div>
        <div className="tile tile--amber">
          <DoorOpen size={16} />
          <span className="tile__value">{plan.leaving.length}</span>
          <span className="tile__label">Klaar</span>
        </div>
      </div>

      {plan.switching.length > 0 && (
        <section className="detail-block">
          <p className="group-title">Van het lager naar het middelbaar</p>
          <ul className="change-list">
            {plan.switching.map((c) => (
              <ChangeRow key={c.person.id} {...c} />
            ))}
          </ul>
        </section>
      )}

      {plan.up.length > 0 && (
        <section className="detail-block">
          <p className="group-title">Eén jaar hoger</p>
          <ul className="change-list">
            {plan.up.map((c) => (
              <ChangeRow key={c.person.id} {...c} />
            ))}
          </ul>
        </section>
      )}

      {plan.leaving.length > 0 && (
        <section className="detail-block">
          <p className="group-title">Klaar met het 6de middelbaar</p>
          <label className="switch-row" htmlFor="archiveLeaversToggle">
            <span className="switch-row__text">
              <strong>Automatisch archiveren</strong>
              <span>Ze verdwijnen uit de lijst, hun historiek blijft bewaard.</span>
            </span>
            <input
              id="archiveLeaversToggle"
              type="checkbox"
              className="switch"
              checked={archiveLeavers}
              onChange={(e) => setArchiveLeavers(e.target.checked)}
            />
          </label>
          <ul className="change-list">
            {plan.leaving.map((c) => (
              <ChangeRow key={c.person.id} {...c} note={archiveLeavers ? 'wordt gearchiveerd' : 'blijft staan'} />
            ))}
          </ul>
        </section>
      )}

      {plan.unknown.length > 0 && (
        <section className="detail-block">
          <p className="group-title">Zonder klas · blijven ongewijzigd</p>
          <div className="name-tags">
            {plan.unknown.map(({ person }) => (
              <span key={person.id} className="name-tag name-tag--muted">
                {fullName(person)}
                {person.extraInfo ? ` (${person.extraInfo})` : ''}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="sheet-actions">
        <button type="button" className="btn btn--glass" onClick={onClose}>
          Annuleren
        </button>
        <button
          id="confirmSchoolYearBtn"
          type="button"
          className="btn btn--primary"
          disabled={changes.length === 0}
          onClick={() => onApply(changes, year)}
        >
          Bevestigen
        </button>
      </div>
    </div>
  );
}

export function SchoolYearSheet({ open, db, todayKey, onApply, onClose }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nieuw schooljaar"
      subtitle={`Iedereen één klas hoger zetten voor ${schoolYear(todayKey)}`}
      labelledBy="schoolYearTitle"
    >
      <SchoolYearBody db={db} todayKey={todayKey} onApply={onApply} onClose={onClose} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Archive                                                             */
/* ------------------------------------------------------------------ */

export function ArchiveSheet({ open, db, onOpenPerson, onRestore, onClose }) {
  const groups = useMemo(
    () =>
      [
        { type: 'students', label: 'Kinderen', icon: Backpack, people: db.students.filter((p) => p.archived).sort(byClass) },
        { type: 'staff', label: 'Medewerkers', icon: Briefcase, people: db.staff.filter((p) => p.archived).sort(byName) },
      ].filter((g) => g.people.length),
    [db.students, db.staff],
  );

  return (
    <Sheet open={open} onClose={onClose} title="Archief" subtitle="Personen die niet meer komen" labelledBy="archiveTitle">
      {groups.length === 0 ? (
        <EmptyState icon={Archive} title="Archief is leeg" text="Archiveer iemand via de detailkaart (•••) om die hier te bewaren." />
      ) : (
        groups.map((g) => (
          <section key={g.type} className="detail-block archive-group">
            <p className="group-title">
              <g.icon size={13} /> {g.label} · {g.people.length}
            </p>
            <ul className="change-list">
              {g.people.map((p) => (
                <li key={p.id} className="change-row change-row--action">
                  <button type="button" className="change-row__main" onClick={() => onOpenPerson(p.id, g.type)}>
                    <Avatar person={p} size={34} className="avatar--muted" />
                    <span className="change-row__text">
                      <span className="change-row__name">{fullName(p)}</span>
                      <span className="change-row__classes">
                        {p.extraInfo && (g.type === 'students' ? <ClassTag person={p} /> : <span className="tag tag--muted">{p.extraInfo}</span>)}
                        {p.archivedAt && <span className="muted">sinds {fmt(p.archivedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={clsx('icon-btn icon-btn--sm', 'change-row__restore')}
                    onClick={() => onRestore(g.type, p.id)}
                    aria-label={`${p.firstName} terugzetten`}
                    title="Terugzetten"
                  >
                    <ArchiveRestore size={17} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Sheet>
  );
}
