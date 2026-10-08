import { useRef, useState } from 'react';
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
} from 'lucide-react';
import { REPORT_PERIODS } from '../lib/reports';
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
}) {
  const [period, setPeriod] = useState('month');
  const fileRef = useRef(null);
  const sessions = Object.keys(db.attendance).length;

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
        {db.students.length} kinderen · {db.staff.length} medewerkers · {sessions} sessies
        <br />
        Huiswerkklas Aanwezigheid · v2.0
      </p>
    </div>
  );
}
