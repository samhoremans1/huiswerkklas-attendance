import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, ChevronDown, Pencil, Backpack, Briefcase, TrendingUp, Trophy, CalendarCheck } from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { fmt, relativeDay, capitalize, monthKey } from '../lib/dates';
import { byName, fullName } from '../lib/people';

function DayCard({ session, todayKey, onEditDay, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const { date, kids, staff } = session;
  const rel = relativeDay(date, todayKey);
  const everyone = [...kids, ...staff];

  return (
    <article className={clsx('day', open && 'is-open')}>
      <button type="button" className="day__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="day__badge">
          <span className="day__num">{fmt(date, { day: 'numeric' })}</span>
          <span className="day__wd">{fmt(date, { weekday: 'short' }).replace('.', '')}</span>
        </div>
        <div className="day__info">
          <span className="day__title">{rel ?? capitalize(fmt(date, { weekday: 'long' }))}</span>
          <span className="day__sub">
            <span className="dot dot--kids" /> {kids.length} <span className="dot dot--staff" /> {staff.length}
          </span>
        </div>
        <div className="avatar-stack" aria-hidden="true">
          {everyone.slice(0, 3).map((p) => (
            <Avatar key={p.id} person={p} size={28} />
          ))}
          {everyone.length > 3 && <span className="avatar-stack__more">+{everyone.length - 3}</span>}
        </div>
        <ChevronDown size={18} className="day__chev" />
      </button>

      <div className="collapse">
        <div className="collapse__inner">
          <div className="day__body">
            {kids.length > 0 && (
              <>
                <p className="group-title">
                  <Backpack size={13} /> Kinderen · {kids.length}
                </p>
                <div className="name-tags">
                  {kids.map((k) => (
                    <span key={k.id} className="name-tag">{fullName(k)}</span>
                  ))}
                </div>
              </>
            )}
            {staff.length > 0 && (
              <>
                <p className="group-title">
                  <Briefcase size={13} /> Medewerkers · {staff.length}
                </p>
                <div className="name-tags">
                  {staff.map((s) => (
                    <span key={s.id} className="name-tag name-tag--staff">{fullName(s)}</span>
                  ))}
                </div>
              </>
            )}
            <button type="button" className="btn btn--glass btn--sm day__edit" onClick={() => onEditDay(date)}>
              <Pencil size={14} /> Aanwezigheid aanpassen
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HistoryView({ db, todayKey, onEditDay, onOpenPerson }) {
  const sessions = useMemo(() => {
    return Object.entries(db.attendance)
      .map(([date, ids]) => {
        const set = new Set(ids);
        return {
          date,
          kids: db.students.filter((s) => set.has(s.id)).sort(byName),
          staff: db.staff.filter((s) => set.has(s.id)).sort(byName),
        };
      })
      .filter((s) => s.kids.length + s.staff.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db]);

  const stats = useMemo(() => {
    const n = sessions.length;
    const kidsTotal = sessions.reduce((sum, s) => sum + s.kids.length, 0);
    const counts = new Map();
    sessions.forEach((s) => s.kids.forEach((k) => counts.set(k.id, (counts.get(k.id) || 0) + 1)));
    const top = db.students
      .filter((s) => counts.get(s.id))
      .map((s) => ({ person: s, count: counts.get(s.id) }))
      .sort((a, b) => b.count - a.count || byName(a.person, b.person))
      .slice(0, 3);
    const thisMonth = sessions.filter((s) => monthKey(s.date) === monthKey(todayKey)).length;
    return { n, avgKids: n ? (kidsTotal / n).toFixed(1).replace('.', ',') : '0', top, thisMonth };
  }, [sessions, db.students, todayKey]);

  const months = useMemo(() => {
    const groups = [];
    sessions.forEach((s) => {
      const key = monthKey(s.date);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: capitalize(fmt(s.date, { month: 'long', year: 'numeric' })), items: [] };
        groups.push(g);
      }
      g.items.push(s);
    });
    return groups;
  }, [sessions]);

  return (
    <div className="view view--history">
      <div className="view-head">
        <h2>Historiek</h2>
        <p>Alle registraties, per maand gegroepeerd.</p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nog geen historiek" text="Zodra je iemand aanwezig zet, verschijnt de dag hier." />
      ) : (
        <>
          <div className="stat-tiles">
            <div className="tile tile--violet">
              <CalendarCheck size={18} />
              <span className="tile__value">{stats.n}</span>
              <span className="tile__label">Sessies</span>
            </div>
            <div className="tile tile--cyan">
              <TrendingUp size={18} />
              <span className="tile__value">{stats.avgKids}</span>
              <span className="tile__label">Gem. kinderen</span>
            </div>
            <div className="tile tile--pink">
              <CalendarDays size={18} />
              <span className="tile__value">{stats.thisMonth}</span>
              <span className="tile__label">Deze maand</span>
            </div>
          </div>

          {stats.top.length > 0 && (
            <section className="card leaderboard">
              <p className="card__title">
                <Trophy size={16} /> Meest aanwezig
              </p>
              <ol>
                {stats.top.map(({ person, count }, i) => (
                  <li key={person.id}>
                    <button type="button" className="leader" onClick={() => onOpenPerson(person.id, 'students')}>
                      <span className={clsx('leader__rank', `leader__rank--${i + 1}`)}>{i + 1}</span>
                      <Avatar person={person} size={34} />
                      <span className="leader__name">{fullName(person)}</span>
                      <span className="leader__count">{count}×</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {months.map((m, mi) => (
            <section key={m.key} className="month">
              <div className="month__head">
                <h3>{m.label}</h3>
                <span>{m.items.length} {m.items.length === 1 ? 'sessie' : 'sessies'}</span>
              </div>
              <div className="month__list">
                {m.items.map((s, i) => (
                  <DayCard key={s.date} session={s} todayKey={todayKey} onEditDay={onEditDay} defaultOpen={mi === 0 && i === 0} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
