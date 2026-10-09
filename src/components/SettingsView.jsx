import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  FileText,
  Download,
  Upload,
  RefreshCw,
  Cloud,
  CloudOff,
  HardDrive,
  Sun,
  Moon,
  Smartphone,
  Share,
  CircleCheck,
  ChevronRight,
  Mail,
  GraduationCap,
  Archive,
  TriangleAlert,
} from 'lucide-react';
import { REPORT_PERIODS, REPORT_RECIPIENT, parseRecipients, isValidEmail } from '../lib/reports';
import { formatTime } from '../lib/dates';

function Row({ id, icon: Icon, tone = 'violet', title, subtitle, onClick, right, as = 'button', children }) {
  const Tag = as;
  return (
    <Tag id={id} type={Tag === 'button' ? 'button' : undefined} className="row" onClick={onClick}>
      <span className={clsx('row__icon', `row__icon--${tone}`)}>
        <Icon size={18} />
      </span>
      <span className="row__text">
        <span className="row__title">{title}</span>
        {subtitle && <span className="row__subtitle">{subtitle}</span>}
      </span>
      {right ?? (onClick && <ChevronRight size={18} className="row__chev" />)}
      {children}
    </Tag>
  );
}

const SYNC_TEXT = {
  syncing: 'Bezig met synchroniseren…',
  synced: 'Alles is up-to-date',
  error: 'Synchronisatie mislukt',
};

function RecipientCard({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]); // follow changes from other devices

  const list = parseRecipients(draft);
  const invalid = list.filter((x) => !isValidEmail(x));
  const dirty = draft.trim() !== value;

  const save = () => {
    if (!dirty || invalid.length) return;
    onSave(list.join(', '));
  };

  return (
    <section className="card">
      <p className="card__title">
        <Mail size={16} /> Mailrapport
      </p>
      <div className="field">
        <label htmlFor="recipientInput" className="field__label">
          Ontvanger(s)
        </label>
        <input
          id="recipientInput"
          className="input"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={REPORT_RECIPIENT}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          enterKeyHint="done"
        />
        {invalid.length > 0 ? (
          <p className="form-hint">
            <TriangleAlert size={15} /> Ongeldig adres: {invalid.join(', ')}
          </p>
        ) : (
          <p className="field__help">
            Meerdere adressen scheiden met een komma. Leeg laten = {REPORT_RECIPIENT}.
          </p>
        )}
      </div>
    </section>
  );
}

export default function SettingsView({
  db,
  theme,
  onThemeChange,
  syncEnabled,
  syncStatus,
  lastSyncedAt,
  onSync,
  onExport,
  onImportFile,
  onWordReport,
  install,
  onInstall,
  onSaveRecipient,
  onOpenSchoolYear,
  onOpenArchive,
  currentSchoolYear,
}) {
  const [period, setPeriod] = useState('month');
  const fileRef = useRef(null);
  const sessions = Object.keys(db.attendance).length;
  const activeKids = db.students.filter((p) => !p.archived).length;
  const activeStaff = db.staff.filter((p) => !p.archived).length;
  const archivedCount = db.students.length + db.staff.length - activeKids - activeStaff;
  const lastYear = db.settings?.lastSchoolYear;

  return (
    <div className="view view--settings">
      <div className="view-head">
        <h2>Meer</h2>
        <p>Rapporten, back-ups en instellingen.</p>
      </div>

      <section className="card">
        <p className="card__title">
          <FileText size={16} /> Word-rapport
        </p>
        <div className="chips chips--fill" role="group" aria-label="Periode">
          {REPORT_PERIODS.map((p) => (
            <button
              key={p.id}
              id={`period-${p.id}`}
              type="button"
              className={clsx('chip', period === p.id && 'is-active')}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button id="downloadWordBtn" type="button" className="btn btn--primary btn--block" onClick={() => onWordReport(period)}>
          <Download size={18} /> Rapport downloaden
        </button>
      </section>

      <RecipientCard value={db.settings?.reportRecipient ?? ''} onSave={onSaveRecipient} />

      <section className="card card--list">
        <p className="card__title card__title--pad">Kinderen &amp; schooljaar</p>
        <Row
          id="schoolYearBtn"
          icon={GraduationCap}
          tone="pink"
          title="Nieuw schooljaar"
          subtitle={
            lastYear === currentSchoolYear
              ? `Al gedaan voor ${currentSchoolYear}`
              : 'Iedereen één klas hoger zetten'
          }
          onClick={onOpenSchoolYear}
        />
        <Row
          id="archiveBtn"
          icon={Archive}
          tone="amber"
          title="Archief"
          subtitle={archivedCount ? `${archivedCount} ${archivedCount === 1 ? 'persoon' : 'personen'} gearchiveerd` : 'Nog niemand gearchiveerd'}
          onClick={onOpenArchive}
        />
      </section>

      <section className="card card--list">
        <p className="card__title card__title--pad">Synchronisatie</p>
        {syncEnabled ? (
          <Row
            id="syncNowBtn"
            icon={syncStatus === 'error' ? CloudOff : Cloud}
            tone={syncStatus === 'error' ? 'red' : 'green'}
            title={SYNC_TEXT[syncStatus] ?? 'GitHub-sync'}
            subtitle={lastSyncedAt ? `Laatst gesynchroniseerd om ${formatTime(lastSyncedAt)}` : 'Tik om nu te synchroniseren'}
            onClick={onSync}
            right={<RefreshCw size={18} className={clsx('row__chev', syncStatus === 'syncing' && 'spin')} />}
          />
        ) : (
          <Row icon={HardDrive} tone="amber" title="Alleen op dit toestel" subtitle="GitHub-sync is niet ingesteld" as="div" />
        )}
      </section>

      <section className="card card--list">
        <p className="card__title card__title--pad">Back-up</p>
        <Row id="exportBtn" icon={Download} tone="cyan" title="Back-up exporteren" subtitle="Download alle gegevens als .json" onClick={onExport} />
        <Row id="importBtn" icon={Upload} tone="violet" title="Back-up importeren" subtitle="Herstel vanuit een .json-bestand" onClick={() => fileRef.current?.click()} />
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = '';
          }}
        />
      </section>

      <section className="card">
        <p className="card__title">Weergave</p>
        <div className="segmented segmented--3" style={{ '--active': ['dark', 'light', 'system'].indexOf(theme) }}>
          <span className="segmented__indicator" aria-hidden="true" />
          {[
            ['dark', 'Donker', Moon],
            ['light', 'Licht', Sun],
            ['system', 'Systeem', Smartphone],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              id={`theme-${id}`}
              type="button"
              className={clsx('segmented__btn', theme === id && 'is-active')}
              onClick={() => onThemeChange(id)}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card card--list">
        <p className="card__title card__title--pad">App</p>
        {install.installed ? (
          <Row icon={CircleCheck} tone="green" title="Geïnstalleerd" subtitle="Je gebruikt de app vanaf je beginscherm" as="div" />
        ) : install.canInstall ? (
          <Row id="installRowBtn" icon={Smartphone} tone="violet" title="Installeer op dit toestel" subtitle="Werkt als een echte app, ook offline" onClick={onInstall} />
        ) : install.isIOS ? (
          <Row icon={Share} tone="cyan" title="Zet op beginscherm" subtitle="Tik in Safari op Delen → ‘Zet op beginscherm’" as="div" />
        ) : (
          <Row icon={Smartphone} tone="violet" title="Installeren" subtitle="Gebruik ‘App installeren’ in het browsermenu" as="div" />
        )}
      </section>

      <p className="footnote">
        {activeKids} kinderen · {activeStaff} medewerkers · {sessions} sessies
        <br />
        Huiswerkklas Aanwezigheid · v2.1
      </p>
    </div>
  );
}
