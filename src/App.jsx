import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  GraduationCap, 
  User, 
  Briefcase, 
  Calendar, 
  Search, 
  Plus, 
  Mail, 
  FileText, 
  Download, 
  Upload, 
  Trash2, 
  Edit3,
  History,
  X,
  Users
} from 'lucide-react';
import clsx from 'clsx';
import { fetchDataFromGitHub, saveDataToGitHub, isGitHubSyncEnabled } from './github-sync';

// Constants
const STORAGE_KEYS = {
  STUDENTS: "hwk_students",
  STAFF: "hwk_staff",
  ATTENDANCE: "hwk_attendance",
};

const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

const App = () => {
  // State
  const [students, setStudents] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS)) || []);
  const [staff, setStaff] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.STAFF)) || []);
  const [attendance, setAttendance] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) || {});
  const [activeTab, setActiveTab] = useState('students'); // 'students', 'staff', 'history'
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // { id, firstName, lastName, extraInfo, type }
  const [statsPerson, setStatsPerson] = useState(null); // { id, firstName, lastName, type }
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'synced', 'error'
  const [dataLoaded, setDataLoaded] = useState(false);
  const saveTimerRef = useRef(null);

  const today = useMemo(() => getTodayStr(), []);

  // Load data from GitHub on mount
  useEffect(() => {
    async function loadFromGitHub() {
      if (!isGitHubSyncEnabled()) {
        setDataLoaded(true);
        return;
      }
      setSyncStatus('syncing');
      try {
        const remote = await fetchDataFromGitHub();
        if (remote) {
          if (remote.students) setStudents(remote.students);
          if (remote.staff) setStaff(remote.staff);
          if (remote.attendance) setAttendance(remote.attendance);
        }
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
      setDataLoaded(true);
    }
    loadFromGitHub();
  }, []);

  // Debounced save to GitHub
  const saveToGitHub = useCallback((studentsData, staffData, attendanceData) => {
    if (!isGitHubSyncEnabled() || !dataLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        await saveDataToGitHub({
          students: studentsData,
          staff: staffData,
          attendance: attendanceData,
        });
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, 1500); // Wait 1.5s after last change before saving
  }, [dataLoaded]);

  // PWA Install Logic
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    });

    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

  // Sync to LocalStorage + GitHub
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    saveToGitHub(students, staff, attendance);
  }, [students]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
    saveToGitHub(students, staff, attendance);
  }, [staff]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
    saveToGitHub(students, staff, attendance);
  }, [attendance]);

  // Ensure today exists in attendance
  useEffect(() => {
    if (!attendance[today]) {
      setAttendance(prev => ({ ...prev, [today]: [] }));
    }
  }, [today, attendance]);

  // Derived State
  const filteredPeople = useMemo(() => {
    const list = activeTab === 'students' ? students : staff;
    return list.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeTab, students, staff, searchTerm]);

  const stats = useMemo(() => {
    const presentIds = attendance[today] || [];
    const kidsCount = students.filter(s => presentIds.includes(s.id)).length;
    const staffCount = staff.filter(s => presentIds.includes(s.id)).length;
    return { kidsCount, staffCount };
  }, [attendance, today, students, staff]);

  // Handlers
  const togglePresence = (id) => {
    setAttendance(prev => {
      const todayAttendance = [...(prev[today] || [])];
      const index = todayAttendance.indexOf(id);
      if (index > -1) {
        todayAttendance.splice(index, 1);
      } else {
        todayAttendance.push(id);
      }
      return { ...prev, [today]: todayAttendance };
    });
  };

  const handleAddEdit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const extraInfo = formData.get('extraInfo');

    if (editingItem) {
      const updateFn = editingItem.type === 'students' ? setStudents : setStaff;
      updateFn(prev => prev.map(p => p.id === editingItem.id ? { ...p, firstName, lastName, extraInfo } : p));
    } else {
      const newItem = { id: Date.now().toString(), firstName, lastName, extraInfo };
      if (activeTab === 'students') setStudents(prev => [...prev, newItem]);
      else setStaff(prev => [...prev, newItem]);
    }
    
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (id, type) => {
    if (!confirm(`Weet je zeker dat je deze persoon wilt verwijderen?`)) return;
    
    if (type === 'students') setStudents(prev => prev.filter(p => p.id !== id));
    else setStaff(prev => prev.filter(p => p.id !== id));

    setAttendance(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(date => {
        newState[date] = newState[date].filter(attId => attId !== id);
      });
      return newState;
    });
  };

  const handleExport = () => {
    const data = { students, staff, attendance };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huiswerkklas_backup_${today}.json`;
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.students && data.staff && data.attendance) {
          if (confirm('Dit zal alle huidige gegevens overschrijven. Weet je het zeker?')) {
            setStudents(data.students);
            setStaff(data.staff);
            setAttendance(data.attendance);
            alert('Gegevens succesvol geïmporteerd!');
          }
        }
      } catch (err) { alert('Fout bij het lezen van bestand.'); }
    };
    reader.readAsText(file);
  };

  const downloadWordReport = () => {
    const dates = Object.keys(attendance).sort((a, b) => new Date(a) - new Date(b));
    
    if (dates.length === 0) {
        alert("Nog geen data beschikbaar voor het rapport.");
        return;
    }

    const title = `Aanwezigheidsrapport Huiswerkklas - ${new Date().toLocaleDateString('nl-NL')}`;

    let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; }
        h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background-color: #f3f4f6; color: #1f2937; text-align: left; padding: 12px; border: 1px solid #e5e7eb; }
        td { padding: 10px; border: 1px solid #e5e7eb; font-size: 11pt; }
        .date-row { background-color: #eff6ff; font-weight: bold; }
        .type-tag { font-size: 9pt; color: #6b7280; font-weight: normal; }
    </style>
    </head>
    <body>
        <h1>Aanwezigheidsoverzicht Huiswerkklas</h1>
        <p>Gegenereerd op: ${new Date().toLocaleString('nl-NL')}</p>
        
        <table>
            <thead>
                <tr>
                    <th>Datum</th>
                    <th>Type</th>
                    <th>Naam</th>
                    <th>Klas / Functie</th>
                </tr>
            </thead>
            <tbody>
    `;

    dates.forEach(date => {
        const attendeeIds = attendance[date];
        const readableDate = new Date(date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        
        attendeeIds.forEach((id, index) => {
            let person = students.find(s => s.id === id);
            let type = "Kind";
            
            if (!person) {
                person = staff.find(st => st.id === id);
                type = "Medewerker";
            }

            if (person) {
                html += `
                <tr>
                    <td>${index === 0 ? `<strong>${readableDate}</strong>` : ''}</td>
                    <td><span class="type-tag">${type}</span></td>
                    <td>${person.firstName} ${person.lastName}</td>
                    <td>${person.extraInfo || '-'}</td>
                </tr>
                `;
            }
        });
    });

    html += `
            </tbody>
        </table>
    </body>
    </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Aanwezigheid_Rapport_${today}.doc`;
    link.click();
    
    alert("Het Word Rapport is gegenereerd!");
  };

  const sendReport = () => {
    const presentIds = attendance[today] || [];
    if (presentIds.length === 0) {
      alert("GEEN AANWEZIGEN: Zorg dat je eerst een paar personen op groen zet!");
      return;
    }

    const presentKids = students.filter(s => presentIds.includes(s.id));
    const presentStaff = staff.filter(s => presentIds.includes(s.id));
    const dateStr = new Date(today).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    
    let bodyText = `Aanwezigheidsrapportage - ${dateStr}\n\n`;
    bodyText += `--- KINDEREN (${presentKids.length}) ---\n`;
    presentKids.forEach(k => bodyText += `- ${k.firstName} ${k.lastName} [${k.extraInfo || 'Geen klas'}]\n`);
    bodyText += `\n--- MEDEWERKERS (${presentStaff.length}) ---\n`;
    presentStaff.forEach(s => bodyText += `- ${s.firstName} ${s.lastName} [${s.extraInfo || 'Geen functie'}]\n`);

    const recipient = "samhoremans1@gmail.com";
    const subject = `Aanwezigheid Huiswerkklas - ${dateStr}`;
    
    if (navigator.clipboard) navigator.clipboard.writeText(bodyText);
    
    window.location.assign(`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`);
    alert("Klaar! De lijst is GEKOPIEERD en je mailprogramma wordt geopend.");
  };

  return (
    <div className="app-container">
      {showInstallBtn && (
        <div className="install-banner">
          <div className="install-banner-text">
            <Download size={16} />
            <span>Installeer als app op dit apparaat</span>
          </div>
          <button className="primary-btn install-banner-btn" onClick={handleInstallClick}>
            Installeren
          </button>
        </div>
      )}
      <header>
        <div className="header-content">
          <div className="logo">
            <GraduationCap className="header-icon" />
            <h1>Huiswerkklas<span>Aanwezigheid</span></h1>
          </div>
          <div className="current-date">
            {isGitHubSyncEnabled() && (
              <span className={clsx("sync-dot", syncStatus)} title={
                syncStatus === 'syncing' ? 'Synchroniseren...' : 
                syncStatus === 'synced' ? 'Gesynchroniseerd' : 
                syncStatus === 'error' ? 'Sync mislukt' : ''
              } />
            )}
            {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </header>

      <main>
        <div className="tabs">
          <button 
            className={clsx("tab-btn", activeTab === 'students' && "active")}
            onClick={() => { setActiveTab('students'); setSearchTerm(''); }}
          >
            <User size={18} /> <span>Kinderen</span>
          </button>
          <button 
            className={clsx("tab-btn", activeTab === 'staff' && "active")}
            onClick={() => { setActiveTab('staff'); setSearchTerm(''); }}
          >
            <Briefcase size={18} /> <span>Medewerkers</span>
          </button>
          <button 
            className={clsx("tab-btn", activeTab === 'history' && "active")}
            onClick={() => setActiveTab('history')}
          >
            <Calendar size={18} /> <span>Historiek</span>
          </button>
        </div>

        {activeTab !== 'history' ? (
          <>
            <div className="action-bar">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Zoek op naam..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} /> Toevoegen
              </button>
            </div>

            <section className="list-container">
              <div className="section-title">
                <h2>{activeTab === 'students' ? 'Geregistreerde Kinderen' : 'Geregistreerde Medewerkers'}</h2>
                <span className="count">{filteredPeople.length}</span>
              </div>
              
              <div className="attendance-list">
                {filteredPeople.length === 0 ? (
                  <div className="empty-state">
                    <Users size={48} />
                    <p>Geen personen gevonden.</p>
                  </div>
                ) : (
                  filteredPeople.map(person => (
                    <div 
                      key={person.id} 
                      className={clsx("attendance-item", (attendance[today] || []).includes(person.id) && "present")}
                      onClick={() => togglePresence(person.id)}
                    >
                      <div className="item-info">
                        <div 
                          className="avatar" 
                          onClick={(e) => { e.stopPropagation(); setStatsPerson({ ...person, type: activeTab }); }}
                        >
                          {person.firstName.charAt(0)}{person.lastName.charAt(0)}
                        </div>
                        <div className="item-name">
                          <span className="full-name">{person.firstName} {person.lastName}</span>
                          {person.extraInfo && <span className="role"><span className="item-badge">{person.extraInfo}</span></span>}
                        </div>
                      </div>
                      <div className="item-actions">
                        <div className="presence-toggle" />
                        <button 
                          className="edit-btn" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setEditingItem({ ...person, type: activeTab });
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          className="delete-btn" 
                          onClick={(e) => { e.stopPropagation(); handleDelete(person.id, activeTab); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <HistoryView 
            attendance={attendance} 
            students={students} 
            staff={staff} 
            handleExport={handleExport}
            handleImport={handleImport}
            downloadWordReport={downloadWordReport}
          />
        )}
      </main>

      <footer>
        <div className="footer-actions">
          <button className="primary-btn report-btn" onClick={sendReport}>
            <Mail size={18} /> Rapportage Versturen
          </button>
        </div>
        <div className="footer-stats">
          <div className="stat-pill kids">
            <span className="stat-label">Kinderen</span>
            <span className="stat-value">{stats.kidsCount}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-pill staff">
            <span className="stat-label">Medewerkers</span>
            <span className="stat-value">{stats.staffCount}</span>
          </div>
        </div>
      </footer>

      {/* Modals handled here for simplicity */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsModalOpen(false); setEditingItem(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? 'Bewerken' : 'Nieuwe Registratie'}</h3>
              <button className="close-modal" onClick={() => { setIsModalOpen(false); setEditingItem(null); }}><X /></button>
            </div>
            <form onSubmit={handleAddEdit}>
              <div className="form-group">
                <label>Voornaam</label>
                <input name="firstName" defaultValue={editingItem?.firstName} required />
              </div>
              <div className="form-group">
                <label>Achternaam</label>
                <input name="lastName" defaultValue={editingItem?.lastName} required />
              </div>
              <div className="form-group">
                <label>{activeTab === 'students' ? 'Klas' : 'Functie / Rol'}</label>
                {activeTab === 'students' ? (
                  <select name="extraInfo" defaultValue={editingItem?.extraInfo || ''} className="form-select">
                    <option value="">-- Kies een leerjaar --</option>
                    <option value="1ste Leerjaar">1ste Leerjaar</option>
                    <option value="2de Leerjaar">2de Leerjaar</option>
                    <option value="3de Leerjaar">3de Leerjaar</option>
                    <option value="4de Leerjaar">4de Leerjaar</option>
                    <option value="5de Leerjaar">5de Leerjaar</option>
                    <option value="6de Leerjaar">6de Leerjaar</option>
                  </select>
                ) : (
                  <input name="extraInfo" defaultValue={editingItem?.extraInfo} placeholder="Bijv. Vrijwilliger" />
                )}
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => { setIsModalOpen(false); setEditingItem(null); }}>Annuleren</button>
                <button type="submit" className="primary-btn">Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statsPerson && (
        <div className="modal-overlay" onClick={() => setStatsPerson(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Stats: {statsPerson.firstName} {statsPerson.lastName}</h3>
              <button className="close-modal" onClick={() => setStatsPerson(null)}><X /></button>
            </div>
            <div className="stats-body">
              <div className="stats-hero">
                <span className="stats-val">
                  {Object.values(attendance).filter(list => list.includes(statsPerson.id)).length}
                </span>
                <span className="stats-lbl">Dagen aanwezig</span>
              </div>
              <div className="presence-history">
                <h4>Datum overzicht:</h4>
                <div className="date-tags">
                  {Object.keys(attendance)
                    .filter(date => attendance[date].includes(statsPerson.id))
                    .sort((a, b) => new Date(b) - new Date(a))
                    .map(date => (
                      <span key={date} className="date-tag">
                        {new Date(date).toLocaleDateString('nl-NL')}
                      </span>
                    ))
                  }
                  {Object.values(attendance).filter(list => list.includes(statsPerson.id)).length === 0 && (
                    <p className="empty-subtext">Nog nergens voor aangemeld.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button className="primary-btn" onClick={() => setStatsPerson(null)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const HistoryView = ({ attendance, students, staff, handleExport, handleImport, downloadWordReport }) => {
  const dates = Object.keys(attendance).sort((a, b) => new Date(b) - new Date(a));

  return (
    <section className="list-container">
      <div className="section-title">
        <h2>Aanwezigheidsgeschiedenis</h2>
        <div className="history-actions">
          <button className="text-btn word-btn" onClick={downloadWordReport}>
            <FileText size={14} /> <span>Word Rapport</span>
          </button>
          <button className="text-btn" onClick={handleExport}><Download size={14} /> <span>Export</span></button>
          <label className="text-btn">
            <Upload size={14} /> <span>Import</span>
            <input type="file" className="hidden-input" accept=".json" onChange={handleImport} />
          </label>
        </div>
      </div>
      
      <div className="history-grid">
        {dates.length === 0 ? (
          <div className="empty-state"><History size={48} /><p>Nog geen geschiedenis.</p></div>
        ) : (
          dates.map(date => {
            const ids = attendance[date];
            if (ids.length === 0) return null;
            const presentKids = students.filter(s => ids.includes(s.id));
            const presentStaff = staff.filter(s => ids.includes(s.id));
            if (presentKids.length === 0 && presentStaff.length === 0) return null;

            return (
              <div key={date} className="history-card">
                <div className="history-header">
                  <div className="history-date">
                    <span className="day-name">{new Date(date).toLocaleDateString("nl-NL", { weekday: 'long' })}</span>
                    <span>{new Date(date).toLocaleDateString("nl-NL", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="history-summary">
                    {presentKids.length > 0 && (
                      <div className="summary-pill kids-pill">
                        <User size={12} /> {presentKids.length}
                      </div>
                    )}
                    {presentStaff.length > 0 && (
                      <div className="summary-pill staff-pill">
                        <Briefcase size={12} /> {presentStaff.length}
                      </div>
                    )}
                  </div>
                </div>
                <div className="history-body">
                  {presentKids.length > 0 && (
                    <>
                      <div className="history-group-title">
                        <User size={14} /> Kinderen
                      </div>
                      <div className="history-names">
                        {presentKids.map(k => <span key={k.id} className="history-name-tag">{k.firstName} {k.lastName}</span>)}
                      </div>
                    </>
                  )}
                  {presentStaff.length > 0 && (
                    <>
                      <div className="history-group-title">
                        <Briefcase size={14} /> Medewerkers
                      </div>
                      <div className="history-names">
                        {presentStaff.map(s => <span key={s.id} className="history-name-tag staff-tag">{s.firstName} {s.lastName}</span>)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default App;
