'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Modal } from 'react-bootstrap';
import { usePageData } from '@/hooks/usePageData';
import { useAction } from '@/context/Flash';
import { apiPost } from '@/lib/api';
import { buildEmailText, copyText, useToast } from '@/components/submission/helpers';
import type { MasterSubmissionPage } from '@/types/submission';

const css = `
/* ══════════════════════════════════════════
   FORM LAYOUT
══════════════════════════════════════════ */
.ms-card {
    background: #fff;
    border-radius: 16px;
    border: 1.5px solid #e5e7eb;
    box-shadow: 0 4px 24px rgba(26,31,58,0.06);
    overflow: hidden;
}
.ms-card-header {
    background: linear-gradient(135deg, #1a1f3a, #2d3561);
    padding: 16px 24px;
    display: flex; align-items: center; gap: 12px;
}
.ms-card-header h2 {
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 1rem; color: #fff; margin: 0;
}
.ms-card-header .hicon {
    width: 36px; height: 36px; border-radius: 10px;
    background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; color: #fff;
}
.ms-body { padding: 24px; }

/* Grid sections */
.form-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px 20px;
}
.form-grid .span2 { grid-column: span 2; }
.form-grid .span3 { grid-column: span 3; }
.form-grid .span1 { grid-column: span 1; }

.section-divider {
    font-family: 'Syne', sans-serif;
    font-weight: 700; font-size: 0.72rem;
    text-transform: uppercase; letter-spacing: 1px;
    color: #9ca3af;
    padding: 14px 0 6px;
    border-top: 1px solid #f0f2f5;
    margin-top: 6px;
    grid-column: 1/-1;
    display: flex; align-items: center; gap: 8px;
}
.section-divider::after {
    content: ''; flex: 1; height: 1px; background: #f0f2f5;
}

/* Field */
.ff { display: flex; flex-direction: column; gap: 5px; }
.ff label {
    font-size: 0.78rem; font-weight: 600; color: #374151;
}
.ff label .req { color: #e84c4c; margin-left: 2px; }

.fctrl {
    width: 100%; padding: 9px 12px;
    border: 1.5px solid #e5e7eb; border-radius: 9px;
    font-size: 0.85rem; font-family: 'DM Sans', sans-serif;
    background: #fff; transition: border-color 0.15s, box-shadow 0.15s;
    color: #1a1f3a;
}
.fctrl:focus {
    outline: none; border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}
.fctrl::placeholder { color: #9ca3af; }
select.fctrl { cursor: pointer; }

/* Drop zones */
.drop-zone {
    border: 2px dashed #d1d5db; border-radius: 10px;
    padding: 18px 12px; text-align: center;
    cursor: pointer; background: #f8faff;
    transition: border-color .15s, background .15s;
}
.drop-zone:hover, .drop-zone.drag-over { border-color: #3b82f6; background: #eff6ff; }
.drop-zone.drag-over { border-style: solid; }
.drop-icon { font-size: 1.6rem; color: #94a3b8; display: block; margin-bottom: 4px; }
.drop-title { font-size: 0.82rem; font-weight: 600; color: #374151; }
.drop-sub { font-size: 0.72rem; color: #9ca3af; }

/* File preview panel */
.file-panel {
    margin-top: 8px; display: flex; flex-direction: column; gap: 6px;
}
.file-card {
    display: flex; align-items: center; gap: 10px;
    background: #fff; border: 1.5px solid #e5e7eb;
    border-radius: 10px; padding: 8px 10px;
    transition: box-shadow .15s;
    position: relative;
}
.file-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.file-card.type-d  { border-left: 4px solid #3b82f6; }
.file-card.type-e  { border-left: 4px solid #10b981; }
.file-card.type-cp { border-left: 4px solid #f59e0b; }
.file-thumb {
    width: 44px; height: 44px; border-radius: 7px; flex-shrink: 0;
    object-fit: cover; background: #f3f4f6;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; overflow: hidden;
}
.file-thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 7px; }
.file-info { flex: 1; min-width: 0; }
.file-name { font-size: 0.8rem; font-weight: 600; color: #1a1f3a;
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-meta { font-size: 0.7rem; color: #9ca3af; margin-top: 1px; }
.file-type-badge {
    font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 4px;
    text-transform: uppercase; letter-spacing: .4px; flex-shrink: 0;
}
.badge-d  { background: #dbeafe; color: #1e40af; }
.badge-e  { background: #d1fae5; color: #065f46; }
.badge-cp { background: #fef3c7; color: #92400e; }
.file-del-btn {
    background: none; border: 1.5px solid #fecdd3; color: #e11d48;
    border-radius: 6px; padding: 4px 8px; cursor: pointer;
    font-size: 0.72rem; flex-shrink: 0; transition: all .15s;
    display: flex; align-items: center; gap: 3px;
}
.file-del-btn:hover { background: #e11d48; color: #fff; border-color: #e11d48; }
.file-chip {
    display: inline-flex; align-items: center; gap: 5px;
    background: #fff; border: 1.5px solid #e5e7eb;
    border-radius: 6px; padding: 3px 8px;
    font-size: 0.75rem; font-weight: 500; color: #374151;
    max-width: 260px;
}
.file-chip .fc-name {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-chip .fc-del {
    cursor: pointer; color: #9ca3af; flex-shrink: 0;
    font-size: 0.7rem; transition: color 0.15s;
    background: none; border: none; padding: 0;
}
.file-chip .fc-del:hover { color: #e84c4c; }
.file-chip.type-d  { border-color: #bfdbfe; background: #eff6ff; }
.file-chip.type-e  { border-color: #bbf7d0; background: #f0fdf4; }
.file-chip.type-cp { border-color: #fde68a; background: #fffbeb; }

/* Action buttons */
.action-bar {
    display: flex; gap: 8px; flex-wrap: wrap;
    padding: 18px 24px;
    border-top: 1px solid #f0f2f5;
    background: #fafbfc;
}
.abtn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 18px; border-radius: 9px;
    font-size: 0.83rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
    border: none; white-space: nowrap;
}
.abtn-primary { background: #1a1f3a; color: #fff; }
.abtn-primary:hover { background: #2d3561; }
.abtn-success { background: #059669; color: #fff; }
.abtn-success:hover { background: #047857; }
.abtn-info    { background: #3b82f6; color: #fff; }
.abtn-info:hover { background: #2563eb; }
.abtn-outline {
    background: #fff; color: #374151;
    border: 1.5px solid #e5e7eb;
}
.abtn-outline:hover { background: #f3f4f6; }
.abtn-danger  { background: #fff1f2; color: #e11d48; border: 1.5px solid #fecdd3; }
.abtn-danger:hover { background: #e11d48; color: #fff; }

/* ══════════════════════════════════════════
   LOG TABLE
══════════════════════════════════════════ */
.log-table {
    font-size: 0.78rem; border-collapse: separate; border-spacing: 0; width: 100%;
}
.log-table th {
    background: #1a1f3a; color: rgba(255,255,255,0.8);
    font-family: 'Syne', sans-serif; font-size: 0.66rem;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    padding: 10px 12px; white-space: nowrap;
}
.log-table td {
    padding: 9px 12px; border-bottom: 1px solid #f0f2f5;
    vertical-align: middle; color: #374151;
}
.log-table tr:hover td { background: #f8faff; }
.log-table tr:last-child td { border-bottom: none; }

.badge-rating {
    display: inline-block; padding: 2px 8px; border-radius: 10px;
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.3px;
}
.badge-excellent { background:#22c55e !important; color:#fff !important; }
.badge-good      { background:#a3e635 !important; color:#1a2e05 !important; }
.badge-above     { background:#facc15 !important; color:#1c1917 !important; }
.badge-avg       { background:#fb923c !important; color:#fff !important; }
.badge-poor      { background:#ef4444 !important; color:#fff !important; }

/* Status badge */
.path-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: #f3f4f6; color: #374151;
    border-radius: 6px; padding: 2px 8px; font-size: 0.72rem;
    max-width: 200px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}

/* Copy feedback */
.copy-flash {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: #1a1f3a; color: #fff;
    padding: 10px 18px; border-radius: 10px;
    font-size: 0.85rem; font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    display: none; animation: slideUp 0.2s ease;
}
@keyframes slideUp {
    from { transform: translateY(12px); opacity:0; }
    to   { transform: translateY(0); opacity:1; }
}
/* react-bootstrap replacement for the inline modal-dialog style (max-width:480px) / modal-content style */
.modal-dialog.ms-import-dialog { max-width: 480px; }
.ms-import-content { border-radius: 16px; border: none; overflow: hidden; }
`;

type PreviewData = { total: number; existing: number; new: number; parse_errors?: string[] };
type ImportView =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'allexist'; d: PreviewData }
  | { kind: 'preview'; d: PreviewData };

const RATINGS = ['Excellent', 'Good', 'Above Average', 'Average', 'Poor'];

function ParseErrors({ list }: { list?: string[] }) {
  if (!list || !list.length) return null;
  return (
    <details style={{ marginTop: 12, fontSize: '0.78rem' }}>
      <summary style={{ cursor: 'pointer', color: '#6b7280', fontWeight: 600 }}>
        {list.length} row(s) skipped (missing data)
      </summary>
      <ul style={{ margin: '6px 0 0 16px', color: '#9ca3af' }}>
        {list.map((e, i) => (
          <li key={i} style={{ fontSize: '0.75rem' }}>
            {e}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ImportBody({ view }: { view: ImportView | null }) {
  if (!view) return null;
  if (view.kind === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div className="spinner-border" style={{ color: '#3b82f6' }}></div>
        <div style={{ marginTop: 12, fontSize: '0.85rem', color: '#6b7280' }}>Checking against database…</div>
      </div>
    );
  }
  if (view.kind === 'error') {
    return <div className="alert alert-danger mb-0">{view.message}</div>;
  }
  const { total, existing, new: newCount, parse_errors } = view.d;
  if (view.kind === 'allexist') {
    return (
      <>
        <div
          style={{
            background: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: 12,
            padding: '18px 20px',
            textAlign: 'center',
          }}
        >
          <i className="bi bi-check-circle-fill" style={{ fontSize: '2rem', color: '#059669' }}></i>
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: '1rem',
              color: '#065f46',
              marginTop: 8,
            }}
          >
            All records already exist
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>
            All {total} submission{total !== 1 ? 's' : ''} from this file are already in the database.
          </div>
        </div>
        <ParseErrors list={parse_errors} />
      </>
    );
  }
  const cardStyle = (bg: string) => ({ background: bg, borderRadius: 10, padding: '12px 16px', textAlign: 'center' as const });
  const num = (n: number, clr: string) => (
    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.6rem', color: clr }}>{n}</div>
  );
  const lbl = { fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, marginTop: 2 };
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 4 }}>
        <div style={cardStyle('#f0f9ff')}>
          {num(total, '#0369a1')}
          <div style={lbl}>In File</div>
        </div>
        <div style={cardStyle('#f0fdf4')}>
          {num(newCount, '#059669')}
          <div style={lbl}>New</div>
        </div>
        <div style={cardStyle('#f9fafb')}>
          {num(existing, '#9ca3af')}
          <div style={lbl}>Already in DB</div>
        </div>
      </div>
      <div
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 9,
          padding: '10px 14px',
          fontSize: '0.8rem',
          color: '#92400e',
          marginTop: 10,
        }}
      >
        <i className="bi bi-info-circle me-1"></i>
        <strong>{newCount}</strong> new submission{newCount !== 1 ? 's' : ''} will be added.{' '}
        {existing ? `${existing} duplicate${existing !== 1 ? 's' : ''} will be skipped.` : ''}
      </div>
      <ParseErrors list={parse_errors} />
    </>
  );
}

export default function MasterSubmissionPage() {
  const { data } = usePageData<MasterSubmissionPage>('/api/pages/master-submission');
  const run = useAction();
  const toast = useToast('ms-toast', 'ms');

  const formRef = useRef<HTMLFormElement>(null);
  const [submissionName, setSubmissionName] = useState('');
  const [mainFolder, setMainFolder] = useState('');
  const [destTouched, setDestTouched] = useState(false);

  // Excel import modal
  const [modalOpen, setModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [view, setView] = useState<ImportView | null>(null);
  const [btnDisabled, setBtnDisabled] = useState(true);
  const [importing, setImporting] = useState(false);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const flashTimer = useRef<any>(null);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  if (!data) return null;
  const { today, teams, checkers, clients, projects } = data;

  // ── Destination path preview ──
  const folder = mainFolder.trim();
  const name = submissionName.trim();
  let destNode: React.ReactNode;
  if (!destTouched) {
    destNode = <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Enter folder path and submission name…</span>;
  } else if (name) {
    const sep = folder.includes('/') ? '/' : '\\';
    destNode = folder ? folder.replace(/[\/]+$/, '') + sep + name : name;
  } else {
    destNode = <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Enter submission name to preview path...</span>;
  }

  const getVal = (n: string, dflt = '') => {
    const el = formRef.current?.elements.namedItem(n) as HTMLInputElement | null;
    return (el && el.value) || dflt;
  };

  async function composeEmail() {
    const project = getVal('job_name');
    const pkg = submissionName || '';
    const rating = getVal('rating');
    const cpRaw = getVal('check_print', 'False');
    const ok = await copyText(buildEmailText(project, pkg, rating, cpRaw === 'True'));
    if (ok) toast.show('Content copied to clipboard', '#059669');
    else toast.show('Copy failed — please copy manually', '#e11d48');
  }

  function clearForm() {
    formRef.current?.reset();
    setSubmissionName('');
    setMainFolder('');
    setDestTouched(true); // updateDestPath() is called
  }

  // Copy Path button -> copyFolderPath() is referenced by the template but never defined in it (no-op / ReferenceError).
  function copyFolderPath() {}

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await run('POST', '/api/actions/master-submission/add', new FormData(form));
    if (res.ok || res.redirect) {
      // Flask redirected to a fresh page: reset the form
      form.reset();
      setSubmissionName('');
      setMainFolder('');
      setDestTouched(false);
    }
  }

  // ── Excel import ──
  async function previewExcelImport(input: HTMLInputElement) {
    const file = input.files && input.files[0];
    if (!file) return;
    setImportFile(file);
    input.value = ''; // reset so same file can be re-selected

    setView({ kind: 'loading' });
    setBtnDisabled(true);
    setImporting(false);
    setModalOpen(true);

    const fd = new FormData();
    fd.append('excel_file', file);
    const d: any = await apiPost('/api/actions/master-submission/preview-excel', fd);
    if (d.status === 0) {
      setView({ kind: 'error', message: 'Network error — could not read file.' });
      return;
    }
    if (!d.ok) {
      setView({ kind: 'error', message: d.error });
      return;
    }
    if (d.new === 0) {
      setView({ kind: 'allexist', d });
      setBtnDisabled(true);
      return;
    }
    setView({ kind: 'preview', d });
    setBtnDisabled(false);
  }

  async function confirmImport() {
    if (!importFile) return;
    setBtnDisabled(true);
    setImporting(true);

    const fd = new FormData();
    fd.append('excel_file', importFile);
    const d: any = await apiPost('/api/actions/master-submission/import-excel', fd);
    if (d.status === 0) {
      setView({ kind: 'error', message: 'Network error during import.' });
      setBtnDisabled(false);
      setImporting(false);
      return;
    }
    if (!d.ok) {
      setView({ kind: 'error', message: d.error });
      setBtnDisabled(false);
      setImporting(false);
      return;
    }
    // Success — hide modal, reload to show updated log
    setModalOpen(false);
    setCopyFlash(`Imported ${d.inserted} record${d.inserted !== 1 ? 's' : ''}!`);
    flashTimer.current = setTimeout(() => {
      setCopyFlash(null);
      window.location.reload();
    }, 1500);
  }

  return (
    <>
      <style>{css}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-send-check-fill me-2" style={{ color: '#3b82f6' }}></i>Package Submission
          </h1>
          <p className="page-subtitle">Track and manage QAQC submissions</p>
        </div>
      </div>

      <div className="row g-4">
        {/* ══ FORM COLUMN ═══════════════════════════════ */}
        <div className="col-xl-7">
          <div className="ms-card">
            <div className="ms-card-header">
              <span className="hicon">
                <i className="bi bi-plus-lg"></i>
              </span>
              <h2>New Submission</h2>
            </div>

            <form id="msForm" ref={formRef} onSubmit={onSubmit}>
              <div className="ms-body">
                <div className="form-grid">
                  {/* ── Dates & Meta ─────────────────── */}
                  <div className="section-divider">
                    <i className="bi bi-calendar3"></i> Details
                  </div>

                  <div className="ff">
                    <label>
                      Received Date<span className="req">*</span>
                    </label>
                    <input type="date" name="received_date" id="receivedDate" className="fctrl" defaultValue={today} required />
                  </div>
                  <div className="ff">
                    <label>
                      Submission Date<span className="req">*</span>
                    </label>
                    <input type="date" name="submission_date" id="submissionDate" className="fctrl" defaultValue={today} required />
                  </div>
                  <div className="ff">
                    <label>QC Checker</label>
                    <select name="qc_checker" className="fctrl" defaultValue="">
                      <option value="">— Select Checker —</option>
                      {checkers.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ff">
                    <label>
                      Team<span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="team"
                      className="fctrl"
                      list="teamList"
                      placeholder="Search team…"
                      autoComplete="off"
                      required
                    />
                    <datalist id="teamList">
                      {teams.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div className="ff">
                    <label>Client</label>
                    <input type="text" name="client" className="fctrl" list="clientList" placeholder="Search client…" autoComplete="off" />
                    <datalist id="clientList">
                      {clients.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div className="ff">
                    <label>Rating</label>
                    <select name="rating" className="fctrl" defaultValue="">
                      <option value="">— Select —</option>
                      {RATINGS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ff">
                    <label>Number of E Sheets</label>
                    <input type="number" name="num_e_sheets" className="fctrl" min="0" placeholder="0" />
                  </div>
                  <div className="ff">
                    <label>Number of D Sheets</label>
                    <input type="number" name="num_d_sheets" className="fctrl" min="0" placeholder="0" />
                  </div>
                  <div className="ff">
                    <label>Check Print</label>
                    <select name="check_print" className="fctrl" defaultValue="False">
                      <option value="False">False</option>
                      <option value="True">True</option>
                    </select>
                  </div>

                  <div className="ff span2">
                    <label>Job Name</label>
                    <input type="text" name="job_name" className="fctrl" list="jobList" placeholder="Search project…" autoComplete="off" />
                    <datalist id="jobList">
                      {projects.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                  <div className="ff">
                    <label>
                      Submission Name<span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="submission_name"
                      id="submissionName"
                      className="fctrl"
                      placeholder="e.g. Testabc"
                      required
                      value={submissionName}
                      onChange={(e) => {
                        setSubmissionName(e.target.value);
                        setDestTouched(true);
                      }}
                    />
                  </div>

                  <div className="ff span3">
                    <label>Remarks</label>
                    <input type="text" name="remarks" className="fctrl" placeholder="Optional notes…" />
                  </div>

                  <div className="ff span3">
                    <label>
                      Reference Path <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional — for your records only)</span>
                    </label>
                    <input
                      type="text"
                      name="main_folder"
                      id="mainFolderPath"
                      className="fctrl"
                      placeholder="e.g. \\server\Projects\Submissions or leave blank"
                      value={mainFolder}
                      onChange={(e) => {
                        setMainFolder(e.target.value);
                        setDestTouched(true);
                      }}
                    />
                  </div>
                </div>
                {/* /form-grid */}
              </div>
              {/* /ms-body */}

              {/* Action Bar */}
              <div className="action-bar">
                <button type="submit" className="abtn abtn-primary">
                  <i className="bi bi-check-lg"></i> Submit
                </button>
                <button type="button" className="abtn abtn-outline" onClick={clearForm}>
                  <i className="bi bi-x-lg"></i> Clear
                </button>
                <button type="button" className="abtn abtn-outline" onClick={() => window.location.reload()}>
                  <i className="bi bi-arrow-clockwise"></i> Refresh
                </button>
                <button type="button" className="abtn abtn-info" onClick={composeEmail}>
                  <i className="bi bi-envelope"></i> Compose Email
                </button>
                <button type="button" className="abtn abtn-outline" onClick={copyFolderPath}>
                  <i className="bi bi-clipboard"></i> Copy Path
                </button>
                <Link href="/master-submission/log" className="abtn abtn-outline">
                  <i className="bi bi-journal-text"></i> Open Log
                </Link>
                <button
                  type="button"
                  className="abtn abtn-outline"
                  onClick={() => document.getElementById('xlsxImportInput')?.click()}
                  style={{ borderColor: '#10b981', color: '#059669' }}
                >
                  <i className="bi bi-file-earmark-spreadsheet"></i> Import Excel
                </button>
                <input
                  type="file"
                  id="xlsxImportInput"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => previewExcelImport(e.currentTarget)}
                />
              </div>
            </form>
          </div>
          {/* /ms-card */}
        </div>

        {/* ══ INFO COLUMN ════════════════════════════════ */}
        <div className="col-xl-5">
          {/* Destination Preview */}
          <div className="ms-card mb-3">
            <div className="ms-card-header" style={{ background: 'linear-gradient(135deg,#0f766e,#0d9488)' }}>
              <span className="hicon">
                <i className="bi bi-folder-check"></i>
              </span>
              <h2>Destination Path Preview</h2>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 6 }}>Files will be copied to:</p>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #bbf7d0',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  color: '#065f46',
                  wordBreak: 'break-all',
                }}
                id="destPathPreview"
              >
                {destNode}
              </div>
              <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: 8, marginBottom: 0 }}>
                <i className="bi bi-info-circle me-1"></i>
                Selected D, E, and Check Print files will be copied into this folder.
              </p>
            </div>
          </div>

          {/* File counts */}
          <div className="ms-card mb-3">
            <div style={{ padding: '14px 20px' }}>
              <div className="row g-2 text-center">
                <div className="col-4">
                  <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 8px' }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: '#2563eb' }} id="countD">
                      0
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>D Sheets</div>
                  </div>
                </div>
                <div className="col-4">
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 8px' }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: '#059669' }} id="countE">
                      0
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>E Sheets</div>
                  </div>
                </div>
                <div className="col-4">
                  <div style={{ background: '#fffbeb', borderRadius: 10, padding: '12px 8px' }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: '#d97706' }} id="countCp">
                      0
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Check Prints</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /row */}

      {/* Copy flash */}
      <div className="copy-flash" id="copyFlash" style={copyFlash ? { display: 'block' } : undefined}>
        {copyFlash && (
          <>
            <i className="bi bi-check-lg me-2"></i> {copyFlash}
          </>
        )}
      </div>

      {toast.node}

      {/* ── Excel Import Modal ──────────────────────────────────────────────────── */}
      <Modal
        show={modalOpen}
        onHide={() => setModalOpen(false)}
        centered
        id="importExcelModal"
        dialogClassName="ms-import-dialog"
        contentClassName="ms-import-content"
      >
        <div
          style={{
            background: 'linear-gradient(135deg,#1a1f3a,#2d3561)',
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(255,255,255,.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                color: '#fff',
              }}
            >
              <i className="bi bi-file-earmark-spreadsheet"></i>
            </span>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.97rem', color: '#fff' }}>
              Import from Excel
            </span>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            style={{
              background: 'rgba(255,255,255,.1)',
              border: 'none',
              color: '#fff',
              borderRadius: 7,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div id="importModalBody" style={{ padding: 22 }}>
          <ImportBody view={view} />
        </div>

        <div
          id="importModalFooter"
          style={{ padding: '14px 22px', borderTop: '1px solid #f0f2f5', display: 'flex', justifyContent: 'flex-end', gap: 8 }}
        >
          <button type="button" className="abtn abtn-outline" onClick={() => setModalOpen(false)}>
            Cancel
          </button>
          <button type="button" className="abtn abtn-primary" id="confirmImportBtn" disabled={btnDisabled} onClick={confirmImport}>
            {importing ? (
              <>
                <span className="spinner-border spinner-border-sm me-1"></span> Importing…
              </>
            ) : (
              <>
                <i className="bi bi-cloud-upload"></i> Import New Records
              </>
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}
