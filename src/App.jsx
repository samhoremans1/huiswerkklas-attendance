import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { useAppData, isValidBackup } from './hooks/useAppData';
import { useTheme, useTodayKey, useInstallPrompt, useToast, useLatest, haptic } from './hooks/ui';
import { Header, BottomNav, Toast } from './components/ui';
import TodayView from './components/TodayView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import { PersonFormSheet, PersonDetailSheet, ConfirmSheet } from './components/PersonSheets';
import { buildDayReport, buildWordReport, downloadBlob, REPORT_RECIPIENT } from './lib/reports';
import { fullName } from './lib/people';

const INSTALL_DISMISS_KEY = 'hwk_install_dismissed';

const copyText = async (text) => {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export default function App() {
  const {
    db,
    syncStatus,
    lastSyncedAt,
    syncEnabled,
    sync,
    togglePresence,
    setPresence,
    addPerson,
    updatePerson,
    deletePerson,
    replaceAll,
  } = useAppData();
  const [theme, setTheme, resolvedTheme] = useTheme();
  const install = useInstallPrompt();
  const { toast, showToast, hideToast } = useToast();
  const todayKey = useTodayKey();

  const [tab, setTab] = useState('today');
  const [segment, setSegment] = useState('students');
  const [dateKey, setDateKey] = useState(todayKey);
  const [installDismissed, setInstallDismissed] = useState(() => !!localStorage.getItem(INSTALL_DISMISS_KEY));

  const [form, setForm] = useState(null); // { key, mode, type, person? }
  const [detail, setDetail] = useState(null); // { id, type }
  const [confirm, setConfirm] = useState(null);

  // Keep the last values while sheets animate out
  const formState = useLatest(form);
  const confirmState = useLatest(confirm);
  const detailPersonLive = detail ? db[detail.type].find((p) => p.id === detail.id) : null;
  const detailData = useLatest(detail && detailPersonLive ? { person: detailPersonLive, type: detail.type } : null);

  // Follow midnight rollover if the user was looking at "today"
  const prevToday = useRef(todayKey);
  useEffect(() => {
    if (prevToday.current !== todayKey) {
      const old = prevToday.current;
      setDateKey((d) => (d === old ? todayKey : d));
      prevToday.current = todayKey;
    }
  }, [todayKey]);

  // Close the detail sheet if that person disappeared (e.g. after sync)
  useEffect(() => {
    if (detail && !detailPersonLive) setDetail(null);
  }, [detail, detailPersonLive]);

  const changeTab = useCallback((next) => {
    setTab(next);
    window.scrollTo(0, 0);
  }, []);

  /* ---------------- attendance ---------------- */
  const handleToggle = useCallback(
    (id) => {
      haptic(10);
      togglePresence(dateKey, id);
    },
    [togglePresence, dateKey],
  );

  const withUndo = (message, snapshot) =>
    showToast(message, { action: { label: 'Ongedaan maken', onClick: () => replaceAll(snapshot) } });

  const handleBulk = (ids, present) => {
    if (!ids.length) return;
    const snapshot = db;
    haptic(20);
    setPresence(dateKey, ids, present);
    withUndo(`${ids.length} ${ids.length === 1 ? 'persoon' : 'personen'} ${present ? 'aanwezig' : 'afwezig'} gezet`, snapshot);
  };

  /* ---------------- people ---------------- */
  const openAdd = (type = segment) => setForm({ key: Date.now(), mode: 'add', type });

  const handleSubmitForm = ({ type, values }) => {
    if (form?.mode === 'edit') {
      updatePerson(form.type, form.person.id, values);
      showToast('Wijzigingen opgeslagen');
    } else {
      addPerson(type, values);
      if (type !== segment) setSegment(type);
      showToast(`${values.firstName} is toegevoegd`);
    }
    setForm(null);
  };

  const handleDelete = () => {
    if (!detailData) return;
    const { person, type } = detailData;
    setConfirm({
      title: `${person.firstName} verwijderen?`,
      message: `${fullName(person)} en alle bijhorende aanwezigheden worden verwijderd.`,
      confirmLabel: 'Verwijderen',
      tone: 'danger',
      icon: <Trash2 size={26} />,
      onConfirm: () => {
        const snapshot = db;
        setDetail(null);
        deletePerson(type, person.id);
        withUndo(`${person.firstName} is verwijderd`, snapshot);
      },
    });
  };

  /* ---------------- reports ---------------- */
  const handleSendReport = async () => {
    const report = buildDayReport(db, dateKey);
    if (report.count === 0) {
      showToast('Nog niemand aanwezig gezet op deze dag', { tone: 'warning' });
      return;
    }
    await copyText(report.text);
    showToast('Lijst gekopieerd – je mailapp wordt geopend');
    setTimeout(() => {
      window.location.href = `mailto:${REPORT_RECIPIENT}?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(report.text)}`;
    }, 350);
  };

  const handleShare = async () => {
    const report = buildDayReport(db, dateKey);
    if (report.count === 0) {
      showToast('Nog niemand aanwezig gezet op deze dag', { tone: 'warning' });
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: report.subject, text: report.text });
      } catch {
        /* user cancelled */
      }
      return;
    }
    const ok = await copyText(report.text);
    showToast(ok ? 'Rapport gekopieerd naar klembord' : 'Delen wordt niet ondersteund', { tone: ok ? 'default' : 'warning' });
  };

  const handleWordReport = (period) => {
    const blob = buildWordReport(db, period);
    if (!blob) {
      showToast('Geen gegevens in deze periode', { tone: 'warning' });
      return;
    }
    downloadBlob(blob, `Aanwezigheid_Rapport_${todayKey}.doc`);
    showToast('Word-rapport gedownload');
  };

  /* ---------------- backup ---------------- */
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `huiswerkklas_backup_${todayKey}.json`);
    showToast('Back-up gedownload');
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let data;
      try {
        data = JSON.parse(e.target.result);
      } catch {
        showToast('Dit bestand kon niet gelezen worden', { tone: 'error' });
        return;
      }
      if (!isValidBackup(data)) {
        showToast('Dit is geen geldige back-up', { tone: 'error' });
        return;
      }
      setConfirm({
        title: 'Back-up herstellen?',
        message: `Dit vervangt alle huidige gegevens door ${data.students.length} kinderen, ${data.staff.length} medewerkers en ${Object.keys(data.attendance).length} dagen.`,
        confirmLabel: 'Herstellen',
        tone: 'danger',
        icon: <Upload size={26} />,
        onConfirm: () => {
          const snapshot = db;
          replaceAll(data);
          withUndo('Back-up hersteld', snapshot);
        },
      });
    };
    reader.readAsText(file);
  };

  /* ---------------- misc ---------------- */
  const handleInstall = async () => {
    const accepted = await install.promptInstall();
    if (accepted) showToast('App wordt geïnstalleerd');
  };

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    setInstallDismissed(true);
  };

  const handleSync = () => {
    if (syncStatus === 'syncing') return;
    sync();
  };

  const editDay = (date) => {
    setDateKey(date);
    changeTab('today');
  };

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true">
        <span className="aurora__blob aurora__blob--1" />
        <span className="aurora__blob aurora__blob--2" />
        <span className="aurora__blob aurora__blob--3" />
      </div>
      <div className="statusbar-shim" aria-hidden="true" />

      <div className="shell">
        <Header
          syncStatus={syncStatus}
          onSync={handleSync}
          resolvedTheme={resolvedTheme}
          onToggleTheme={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        />

        <main key={tab} className="main">
          {tab === 'today' && (
            <TodayView
              db={db}
              dateKey={dateKey}
              todayKey={todayKey}
              onDateChange={setDateKey}
              segment={segment}
              onSegmentChange={setSegment}
              onToggle={handleToggle}
              onBulk={handleBulk}
              onOpenPerson={(id, type) => setDetail({ id, type })}
              onAdd={openAdd}
              onSendReport={handleSendReport}
              onShare={handleShare}
              install={{ ...install, dismissed: installDismissed }}
              onInstall={handleInstall}
              onDismissInstall={dismissInstall}
            />
          )}
          {tab === 'history' && (
            <HistoryView db={db} todayKey={todayKey} onEditDay={editDay} onOpenPerson={(id, type) => setDetail({ id, type })} />
          )}
          {tab === 'settings' && (
            <SettingsView
              db={db}
              theme={theme}
              onThemeChange={setTheme}
              syncEnabled={syncEnabled}
              syncStatus={syncStatus}
              lastSyncedAt={lastSyncedAt}
              onSync={handleSync}
              onExport={handleExport}
              onImportFile={handleImportFile}
              onWordReport={handleWordReport}
              install={install}
              onInstall={handleInstall}
            />
          )}
        </main>
      </div>

      {tab === 'today' && (
        <button id="addPersonFab" type="button" className="fab" onClick={() => openAdd(segment)} aria-label="Persoon toevoegen">
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      <Toast toast={toast} onClose={hideToast} />
      <BottomNav tab={tab} onChange={changeTab} />

      <PersonFormSheet open={!!form} state={formState} db={db} onSubmit={handleSubmitForm} onClose={() => setForm(null)} />
      <PersonDetailSheet
        open={!!detail && !!detailPersonLive}
        person={detailData?.person}
        type={detailData?.type}
        db={db}
        todayKey={todayKey}
        onClose={() => setDetail(null)}
        onDelete={handleDelete}
        onEdit={() => {
          const { person, type } = detailData;
          setDetail(null);
          setForm({ key: Date.now(), mode: 'edit', type, person });
        }}
      />
      <ConfirmSheet open={!!confirm} state={confirmState} onClose={() => setConfirm(null)} />
    </div>
  );
}
