'use client';
import { DragEvent, FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePageData } from '@/hooks/usePageData';
import { apiGet, apiPost, qs } from '@/lib/api';
import { buildEmailText, copyText, useToast } from '@/components/submission/helpers';
import type { Submission, SubmissionLogPage } from '@/types/submission';

const css = `
.log-table { font-size:0.78rem; border-collapse:separate; border-spacing:0; width:100%; }
.log-table th {
    background:#1a1f3a; color:rgba(255,255,255,0.8);
    font-family:'Syne',sans-serif; font-size:0.66rem; font-weight:700;
    text-transform:uppercase; letter-spacing:0.8px;
    padding:10px 12px; white-space:nowrap;
    cursor:pointer; user-select:none;
    transition: background .15s;
}
.log-table th:hover { background:#2d3561; }
.log-table th.sort-asc,
.log-table th.sort-desc { background:#2d3561; color:#fff; }
.log-table th .sort-icon { margin-left:5px; font-size:0.6rem; opacity:0.5; }
.log-table th.sort-asc  .sort-icon,
.log-table th.sort-desc .sort-icon { opacity:1; }
.log-table td { padding:9px 12px; border-bottom:1px solid #f0f2f5; vertical-align:middle; color:#374151; }
.log-table tbody tr:nth-child(odd)  td { background:#f1f1f1; }
.log-table tbody tr:nth-child(even) td { background:#ffffff; }
.log-table tr:hover td { background:#eef4ff !important; }
.log-table tr:last-child td { border-bottom:none; }
.badge-rating    { display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700; }
.badge-excellent { background:#22c55e !important; color:#fff !important; }
.badge-good      { background:#a3e635 !important; color:#1a2e05 !important; }
.badge-above     { background:#facc15 !important; color:#1c1917 !important; }
.badge-avg       { background:#fb923c !important; color:#fff !important; }
.badge-poor      { background:#ef4444 !important; color:#fff !important; }
.path-chip { display:inline-flex; align-items:center; gap:4px; background:#f3f4f6; color:#374151; border-radius:6px; padding:2px 8px; font-size:0.72rem; max-width:200px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.path-chip-btn { cursor:pointer; border:none; transition:background .15s,color .15s; }
.path-chip-btn:hover { background:#1a1f3a; color:#fff; }
.open-folder-btn { display:inline-flex; align-items:center; gap:3px; background:#f3f4f6; color:#374151; border:none; border-radius:5px; padding:2px 7px; font-size:0.7rem; cursor:pointer; margin-top:3px; transition:background .15s,color .15s; }
.open-folder-btn:hover { background:#1a1f3a; color:#fff; }
.files-toggle { display:inline-flex;align-items:center;gap:2px;padding:1px 5px;border-radius:4px;border:1px solid #d1d5db;background:#f9fafb;color:#6b7280;font-size:0.65rem;cursor:pointer;line-height:1;flex-shrink:0; }
.files-toggle:hover { background:#1a1f3a;color:#fff;border-color:#1a1f3a; }
.files-extra { display:none;flex-direction:column;gap:3px; }
.file-chip { display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:2px 7px;border-radius:5px;text-decoration:none;white-space:nowrap; }
.file-chip-d { background:#dbeafe;color:#1e40af; }
.file-chip-e { background:#d1fae5;color:#065f46; }
.file-chip-o { background:#fef3c7;color:#92400e; }
.abtn { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:8px; font-size:0.78rem; font-weight:600; cursor:pointer; border:none; text-decoration:none; transition:all .15s; }
.abtn-danger { background:#fff1f2; color:#e11d48; border:1.5px solid #fecdd3; }
.abtn-danger:hover { background:#e11d48; color:#fff; }
.abtn-edit { background:#eff6ff; color:#2563eb; border:1.5px solid #bfdbfe; }
.abtn-edit:hover { background:#2563eb; color:#fff; }
.filter-bar { background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
.filter-bar input, .filter-bar select { border:1px solid #e5e7eb; border-radius:7px; padding:6px 10px; font-size:0.85rem; font-family:'DM Sans',sans-serif; outline:none; }
.filter-bar input:focus, .filter-bar select:focus { border-color:#1a1f3a; }
/* Pagination */
.pagination-bar { display:flex; align-items:center; justify-content:center; gap:4px; padding:16px 0 4px; flex-wrap:wrap; }
.pg-btn { display:inline-flex; align-items:center; justify-content:center; min-width:34px; height:34px; padding:0 8px; border-radius:7px; border:1px solid #e5e7eb; background:#fff; color:#374151; font-size:0.82rem; font-weight:500; text-decoration:none; transition:all .15s; cursor:pointer; }
.pg-btn:hover { background:#f3f4f6; border-color:#d1d5db; color:#1a1f3a; }
.pg-btn.active { background:#1a1f3a; border-color:#1a1f3a; color:#fff; font-weight:700; }
.pg-btn.disabled { opacity:0.4; pointer-events:none; }
/* Edit modal */
#edit-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1050; align-items:center; justify-content:center; }
#edit-overlay.open { display:flex; }
/* Bulk upload modal */
#bulk-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1050; align-items:center; justify-content:center; }
#bulk-overlay.open { display:flex; }
/* Load from Excel modal */
#lfe-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1050; align-items:center; justify-content:center; }
#lfe-overlay.open { display:flex; }
#edit-modal { background:#fff; border-radius:14px; width:min(680px,96vw); max-height:90vh; overflow-y:auto; padding:28px 28px 20px; box-shadow:0 20px 60px rgba(0,0,0,.25); }
#edit-modal h5 { font-family:'Syne',sans-serif; font-size:1.05rem; font-weight:800; color:#1a1f3a; margin-bottom:18px; }
.em-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 18px; }
.em-grid .full { grid-column:1/-1; }
.em-label { font-size:0.75rem; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; display:block; margin-bottom:4px; }
.em-input { width:100%; border:1px solid #e5e7eb; border-radius:7px; padding:7px 10px; font-size:0.85rem; font-family:'DM Sans',sans-serif; outline:none; }
.em-input:focus { border-color:#1a1f3a; }
.em-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; padding-top:16px; border-top:1px solid #f3f4f6; }
`;

const SORT_COLS: [string, string][] = [
  ['submission_name', 'Sub Name'],
  ['client', 'Client'],
  ['received_date', 'Received'],
  ['submission_date', 'Sub Date'],
  ['qc_checker', 'QC Checker'],
  ['team', 'Team'],
];

const GRAY = { border: '#e5e7eb', bg: '' };

/** Shared drag&drop styling logic of the bulk / load-from-excel drop zones. */
function useDropZone(hi: { border: string; bg: string }, onFile: (f: File) => void) {
  const [st, setSt] = useState(GRAY);
  const handlers = {
    onDragEnter: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setSt(hi);
    },
    onDragOver: (e: DragEvent<HTMLDivElement>) => e.preventDefault(),
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setSt(GRAY);
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setSt(GRAY);
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) onFile(f);
    },
  };
  return { st, setSt, handlers };
}

const errBox = (children: React.ReactNode) => (
  <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem' }}>
    <i className="bi bi-x-circle-fill me-1"></i> {children}
  </div>
);

function RatingBadge({ rating }: { rating: string }) {
  switch (rating) {
    case 'Excellent':
      return <span className="badge-rating badge-excellent" style={{ background: '#22c55e', color: '#fff' }}>Excellent</span>;
    case 'Good':
      return <span className="badge-rating badge-good" style={{ background: '#a3e635', color: '#1a2e05' }}>Good</span>;
    case 'Above Average':
      return <span className="badge-rating badge-above" style={{ background: '#facc15', color: '#1c1917' }}>Above Avg</span>;
    case 'Average':
      return <span className="badge-rating badge-avg" style={{ background: '#fb923c', color: '#fff' }}>Average</span>;
    case 'Poor':
      return <span className="badge-rating badge-poor" style={{ background: '#ef4444', color: '#fff' }}>Poor</span>;
    default:
      return <span style={{ color: '#9ca3af' }}>—</span>;
  }
}

const fileChipCls = (type: string) => (type === 'D Sheet' ? 'file-chip-d' : type === 'E Sheet' ? 'file-chip-e' : 'file-chip-o');
const fileHref = (id: number, stored: string) => `/api/actions/master-submission/file/${id}/${encodeURIComponent(stored)}`;
const clip = (s: string, n: number) => (s || '').slice(0, n);

function FilesCell({ s, onOpenFolder }: { s: Submission; onOpenFolder: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const ufiles = s.uploaded_files && s.uploaded_files.length ? s.uploaded_files : [];
  if (ufiles.length) {
    const dest = ufiles[0].dest_dir || '';
    const chip = (f: (typeof ufiles)[number], k?: number) => (
      <a
        key={k}
        href={fileHref(s.id, f.stored)}
        target="_blank"
        rel="noreferrer"
        className={`file-chip ${fileChipCls(f.type)}`}
        title={f.original}
      >
        <i className="bi bi-file-earmark-arrow-down"></i>
        {f.type} — {clip(f.original, 20)}
        {f.original.length > 20 ? '…' : ''}
      </a>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {chip(ufiles[0])}
          {ufiles.length > 1 && (
            <button className="files-toggle" onClick={() => setOpen((o) => !o)} title={`Show ${ufiles.length - 1} more file(s)`}>
              <i className={open ? 'bi bi-chevron-up' : 'bi bi-chevron-down'} style={{ fontSize: '0.6rem' }}></i>
              <span>+{ufiles.length - 1}</span>
            </button>
          )}
        </div>
        {ufiles.length > 1 && (
          <div className="files-extra" style={open ? { display: 'flex', flexDirection: 'column' } : { display: 'none', flexDirection: 'column' }}>
            {ufiles.slice(1).map((f, i) => chip(f, i))}
          </div>
        )}
        {dest && (
          <button className="open-folder-btn" onClick={() => onOpenFolder(dest)} title={dest}>
            <i className="bi bi-folder2-open"></i> Open Folder
          </button>
        )}
      </div>
    );
  }
  if (s.main_folder) {
    const fullPath = s.main_folder + '/' + s.submission_name;
    return (
      <button className="path-chip path-chip-btn" onClick={() => onOpenFolder(fullPath)} title={'Click to open: ' + fullPath}>
        <i className="bi bi-folder2-open" style={{ flexShrink: 0 }}></i>
        {fullPath.slice(-30)}
      </button>
    );
  }
  return <span style={{ color: '#9ca3af' }}>—</span>;
}

const EMPTY_EDIT: Record<string, string> = {
  submission_date: '',
  received_date: '',
  team: '',
  qc_checker: '',
  client: '',
  rating: '',
  job_name: '',
  submission_name: '',
  num_e_sheets: '',
  num_d_sheets: '',
  check_print: 'False',
  submitted_by: '',
  main_folder: '',
  remarks: '',
};

function SubmissionLogInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const pageQs = qs({
    page: sp.get('page'),
    q: sp.get('q'),
    team: sp.get('team'),
    checker: sp.get('checker'),
    rating: sp.get('rating'),
    sort: sp.get('sort'),
    order: sp.get('order'),
  });
  const { data, reload } = usePageData<SubmissionLogPage>('/api/pages/submission-log' + pageQs);
  const toast = useToast('log-toast', 'log');

  // inline delete state
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const [fading, setFading] = useState<Set<number>>(new Set());
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  useEffect(() => {
    setDeleting(new Set());
    setFading(new Set());
    setRemoved(new Set());
  }, [data]);

  // edit modal
  const [editId, setEditId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>(EMPTY_EDIT);
  const [saveLabel, setSaveLabel] = useState('Save Changes');
  const [saveDisabled, setSaveDisabled] = useState(false);

  // bulk upload modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [bulkResult, setBulkResult] = useState<React.ReactNode>(null);
  const bulkInput = useRef<HTMLInputElement>(null);

  // load-from-excel modal
  const [lfeOpen, setLfeOpen] = useState(false);
  const [lfeFile, setLfeFile] = useState<File | null>(null);
  const [lfeStep, setLfeStep] = useState<'pick' | 'confirm'>('pick');
  const [lfeParseErr, setLfeParseErr] = useState<React.ReactNode>(null);
  const [lfeChecking, setLfeChecking] = useState(false);
  const [lfeSummary, setLfeSummary] = useState<any>(null);
  const [lfeConfirmMsg, setLfeConfirmMsg] = useState<React.ReactNode>(null);
  const [lfeImp, setLfeImp] = useState<'idle' | 'importing' | 'done'>('idle');
  const [lfeLabel, setLfeLabel] = useState('Import New Records');
  const [lfeImpDisabled, setLfeImpDisabled] = useState(false);
  const lfeInput = useRef<HTMLInputElement>(null);

  const timers = useRef<any[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const bulkDrop = useDropZone({ border: '#7c3aed', bg: '#f5f3ff' }, (f) => selectBulk(f));
  const lfeDrop = useDropZone({ border: '#d97706', bg: '#fffbeb' }, (f) => selectLfe(f));

  if (!data) return null;
  const {
    submissions,
    teams,
    checkers,
    clients,
    page,
    total_pages,
    total,
    per_page,
    stats,
    q,
    team_filter,
    checker_filter,
    rating_filter,
    sort,
    order,
  } = data;

  // ── Filter form (method GET to the same page) ──
  function onFilterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    ['q', 'team', 'checker', 'rating'].forEach((k) => p.set(k, String(fd.get(k) ?? '')));
    router.push('/master-submission/log?' + p.toString());
  }

  // ── Server-side sort ──
  function sortTable(col: string) {
    const p = new URLSearchParams(sp.toString());
    const currentSort = p.get('sort') || 'submission_date';
    const currentOrder = p.get('order') || 'desc';
    const newOrder = currentSort === col && currentOrder === 'asc' ? 'desc' : 'asc';
    p.set('sort', col);
    p.set('order', newOrder);
    p.set('page', '1');
    router.push('/master-submission/log?' + p.toString());
  }

  const pageHref = (p: number) => '/master-submission/log' + qs({ page: p, q, team: team_filter, checker: checker_filter, rating: rating_filter, sort, order });

  // ── Inline delete ──
  async function deleteRow(subId: number) {
    if (!confirm('Delete submission #' + subId + '?')) return;
    setDeleting((s) => new Set(s).add(subId));
    const res = await apiPost('/api/actions/master-submission/delete/' + subId);
    if (res.status === 0 || (res.status ?? 0) >= 500) {
      setDeleting((s) => {
        const n = new Set(s);
        n.delete(subId);
        return n;
      });
      alert('Delete failed. Please try again.');
      return;
    }
    if (res.ok) {
      setFading((s) => new Set(s).add(subId));
      timers.current.push(
        setTimeout(() => setRemoved((s) => new Set(s).add(subId)), 260)
      );
    }
  }

  // ── Open folder ──
  async function copyPathToClipboard(path: string) {
    const ok = await copyText(path);
    if (ok) toast.show('Path copied to clipboard: ' + path, '#1a1f3a');
    else toast.show('Could not open or copy path', '#e11d48');
  }
  async function openFolder(path: string) {
    const d = await apiPost('/api/actions/open-folder', { path });
    if (!d.ok) copyPathToClipboard(path);
  }

  // ── Edit modal ──
  async function openEdit(sid: number) {
    setEditId(sid);
    setSaveLabel('Save Changes');
    setSaveDisabled(false);
    let d: any;
    try {
      d = await apiGet('/api/submissions/' + sid);
    } catch {
      return;
    }
    setEditForm({
      submission_date: d.submission_date || '',
      received_date: d.received_date || '',
      team: d.team || '',
      qc_checker: d.qc_checker || '',
      client: d.client || '',
      rating: d.rating || '',
      job_name: d.job_name || '',
      submission_name: d.submission_name || '',
      num_e_sheets: d.num_e_sheets ? String(d.num_e_sheets) : '',
      num_d_sheets: d.num_d_sheets ? String(d.num_d_sheets) : '',
      check_print: d.check_print || 'False',
      submitted_by: d.submitted_by || '',
      main_folder: d.main_folder || '',
      remarks: d.remarks || '',
    });
    setEditOpen(true);
  }
  function closeEdit() {
    setEditOpen(false);
    setEditId(null);
  }
  async function onEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editId) return;
    setSaveDisabled(true);
    setSaveLabel('Saving…');
    const res = await apiPost('/api/actions/master-submission/update/' + editId, new FormData(e.currentTarget));
    if (res.ok) {
      closeEdit();
      reload();
    } else {
      alert(res.status === 0 || (res.status ?? 0) >= 500 ? 'Save failed. Please try again.' : 'Save failed.');
      setSaveDisabled(false);
      setSaveLabel('Save Changes');
    }
  }
  const setEd = (k: string) => (e: React.ChangeEvent<any>) => setEditForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Load from Excel ──
  function selectLfe(file: File) {
    setLfeFile(file);
    lfeDrop.setSt({ border: '#059669', bg: '#f0fdf4' });
    setLfeParseErr(null);
  }
  function closeLfe() {
    setLfeOpen(false);
    setLfeFile(null);
    if (lfeInput.current) lfeInput.current.value = '';
    lfeDrop.setSt(GRAY);
    setLfeParseErr(null);
    setLfeStep('pick');
    setLfeChecking(false);
  }
  async function lfePreview() {
    if (!lfeFile) return;
    setLfeChecking(true);
    const fd = new FormData();
    fd.append('excel_file', lfeFile);
    const d: any = await apiPost('/api/actions/master-submission/preview-excel', fd);
    setLfeChecking(false);
    if (d.status === 0) {
      setLfeParseErr(errBox('Failed to connect to server. Please try again.'));
      return;
    }
    if (!d.ok) {
      setLfeParseErr(errBox(d.error || 'Could not read file.'));
      return;
    }
    setLfeSummary(d);
    setLfeConfirmMsg(null);
    setLfeImp('idle');
    if (d.new === 0) {
      setLfeLabel('Nothing to Import');
      setLfeImpDisabled(true);
    } else {
      setLfeLabel(`Import ${d.new} New Record${d.new !== 1 ? 's' : ''}`);
      setLfeImpDisabled(false);
    }
    setLfeStep('confirm');
  }
  async function lfeImport() {
    if (!lfeFile) return;
    setLfeImpDisabled(true);
    setLfeImp('importing');
    const fd = new FormData();
    fd.append('excel_file', lfeFile);
    const d: any = await apiPost('/api/actions/master-submission/import-excel', fd);
    if (d.status === 0) {
      setLfeConfirmMsg(errBox('Import failed. Please try again.'));
      setLfeImpDisabled(false);
      setLfeImp('idle');
      setLfeLabel('Import New Records');
      return;
    }
    if (d.ok) {
      setLfeConfirmMsg(
        <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem' }}>
          <i className="bi bi-check-circle-fill me-1"></i>
          <strong>{d.inserted}</strong> record(s) imported.{' '}
          {d.skipped ? <span style={{ color: '#6b7280' }}>{d.skipped} skipped (already exist).</span> : null}
          {d.errors && d.errors.length ? (
            <>
              <div style={{ marginTop: 6, color: '#854d0e', fontWeight: 600 }}>Warnings:</div>
              <ul style={{ margin: '4px 0 0 16px', fontSize: '0.78rem' }}>
                {d.errors.map((e: string, i: number) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      );
      setLfeImp('done');
      if (d.inserted > 0)
        timers.current.push(
          setTimeout(() => {
            closeLfe();
            window.location.reload();
          }, 1800)
        );
    } else {
      setLfeConfirmMsg(errBox(d.error || 'Import failed.'));
      setLfeImpDisabled(false);
      setLfeImp('idle');
      setLfeLabel('Import New Records');
    }
  }

  // ── Bulk upload ──
  function selectBulk(file: File) {
    if (!file) return;
    setBulkFile(file);
    bulkDrop.setSt({ border: '#059669', bg: '#f0fdf4' });
    setBulkResult(null);
  }
  function closeBulk() {
    setBulkOpen(false);
    setBulkFile(null);
    if (bulkInput.current) bulkInput.current.value = '';
    bulkDrop.setSt(GRAY);
    setBulkResult(null);
    setBulkBusy('idle');
  }
  async function submitBulk() {
    if (!bulkFile) return;
    setBulkBusy('uploading');
    const fd = new FormData();
    fd.append('excel_file', bulkFile);
    const d: any = await apiPost('/api/actions/master-submission/bulk-upload', fd);
    if (d.status === 0) {
      setBulkResult(errBox('Upload failed. Please try again.'));
      setBulkBusy('idle');
      return;
    }
    if (d.ok) {
      setBulkResult(
        <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem' }}>
          <i className="bi bi-check-circle-fill me-1"></i>
          <strong>{d.inserted}</strong> record(s) imported successfully.
          {d.errors && d.errors.length ? (
            <>
              <div style={{ marginTop: 6, color: '#854d0e', fontWeight: 600 }}>Warnings ({d.errors.length}):</div>
              <ul style={{ margin: '4px 0 0 16px', fontSize: '0.78rem' }}>
                {d.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      );
      setBulkBusy('done');
      if (d.inserted > 0)
        timers.current.push(
          setTimeout(() => {
            closeBulk();
            window.location.reload();
          }, 1800)
        );
    } else {
      setBulkResult(errBox(d.error || 'Upload failed.'));
      setBulkBusy('idle');
    }
  }

  async function copyEmailTemplate(s: Submission) {
    const ok = await copyText(buildEmailText(s.job_name || '', s.submission_name || '', s.rating || '', s.check_print === 'True'));
    if (ok) toast.show('Content copied to clipboard', '#059669');
    else toast.show('Copy failed — please copy manually', '#e11d48');
  }

  // ── Pagination window ──
  const winStart = Math.max(1, page - 2);
  const winEnd = Math.min(total_pages, page + 2);
  const winPages: number[] = [];
  for (let p = winStart; p <= winEnd; p++) winPages.push(p);

  const shownTotal = Math.max(0, total - removed.size);
  const statCard = (val: any, color: string, label: string) => (
    <div className="col-6 col-md-2">
      <div className="card p-3 text-center">
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.8rem', fontWeight: 800, color }}>{val}</div>
        <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{label}</div>
      </div>
    </div>
  );

  const bulkDisabled = !bulkFile || bulkBusy !== 'idle';
  const lfePreviewDisabled = !lfeFile || lfeChecking;

  return (
    <>
      <style>{css}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-journal-text me-2" style={{ color: '#3b82f6' }}></i>Submission Log
          </h1>
          <p className="page-subtitle">All master submission records</p>
        </div>
        <div className="d-flex gap-2">
          <Link href="/master-submission" className="btn btn-sm btn-secondary">
            <i className="bi bi-plus-lg me-1"></i> New Submission
          </Link>
          <button
            onClick={() => setBulkOpen(true)}
            className="btn btn-sm"
            style={{ background: '#7c3aed', color: '#fff', borderRadius: 8, border: 'none' }}
          >
            <i className="bi bi-upload me-1"></i> Bulk Upload
          </button>
          <button
            onClick={() => setLfeOpen(true)}
            className="btn btn-sm"
            style={{ background: '#d97706', color: '#fff', borderRadius: 8, border: 'none' }}
          >
            <i className="bi bi-file-earmark-arrow-up me-1"></i> Load from Excel
          </button>
          <a href="/api/actions/master-submission/export" className="btn btn-sm" style={{ background: '#059669', color: '#fff', borderRadius: 8 }}>
            <i className="bi bi-file-earmark-excel me-1"></i> Export Excel
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div className="row g-3 mb-3">
        {statCard(total, '#1a1f3a', 'Total')}
        {statCard(stats['Excellent'] ?? 0, '#22c55e', 'Excellent')}
        {statCard(stats['Good'] ?? 0, '#a3e635', 'Good')}
        {statCard(stats['Above Average'] ?? 0, '#ca8a04', 'Above Avg')}
        {statCard(stats['Average'] ?? 0, '#fb923c', 'Average')}
        {statCard(stats['Poor'] ?? 0, '#ef4444', 'Poor')}
      </div>

      {/* Filter bar */}
      <FilterBar
        key={sp.toString()}
        onSubmit={onFilterSubmit}
        q={q}
        teams={teams}
        checkers={checkers}
        team_filter={team_filter}
        checker_filter={checker_filter}
        rating_filter={rating_filter}
        countText={
          <>
            {shownTotal} record{total !== 1 ? 's' : ''}
            {total_pages > 1 ? <>&nbsp;·&nbsp;page {page}/{total_pages}</> : null}
          </>
        }
      />

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          {submissions.length ? (
            <table className="log-table" id="sl-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'default' }}>#</th>
                  {SORT_COLS.map(([col, label]) => (
                    <SortTh key={col} col={col} label={label} sort={sort} order={order} onSort={sortTable} />
                  ))}
                  <th>CP</th>
                  <SortTh col="num_e_sheets" label="E" sort={sort} order={order} onSort={sortTable} />
                  <SortTh col="num_d_sheets" label="D" sort={sort} order={order} onSort={sortTable} />
                  <SortTh col="rating" label="Rating" sort={sort} order={order} onSort={sortTable} />
                  <th>Remarks</th>
                  <th>Files</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="sl-body">
                {submissions.map((s, idx) => {
                  if (removed.has(s.id)) return null;
                  const isFading = fading.has(s.id);
                  return (
                    <tr
                      key={s.id}
                      style={isFading ? { transition: 'opacity .25s, transform .25s', opacity: 0, transform: 'translateX(16px)' } : undefined}
                    >
                      <td style={{ color: '#9ca3af', fontSize: '0.72rem' }}>{(page - 1) * per_page + idx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#1a1f3a' }}>{s.submission_name}</td>
                      <td>{s.client}</td>
                      <td>{s.received_date}</td>
                      <td>{s.submission_date}</td>
                      <td>{s.qc_checker}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{s.team}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {s.check_print === 'True' ? (
                          <i className="bi bi-check-circle-fill" style={{ color: '#059669' }}></i>
                        ) : (
                          <i className="bi bi-x-circle" style={{ color: '#d1d5db' }}></i>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#059669' }}>{s.num_e_sheets || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#2563eb' }}>{s.num_d_sheets || '—'}</td>
                      <td>
                        <RatingBadge rating={s.rating} />
                      </td>
                      <td style={{ maxWidth: 140, color: '#6b7280', fontSize: '0.75rem' }} title={s.remarks}>
                        {s.remarks && s.remarks.length > 40 ? s.remarks.slice(0, 40) + '…' : s.remarks || '—'}
                      </td>
                      <td>
                        <FilesCell s={s} onOpenFolder={openFolder} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="abtn abtn-edit" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => openEdit(s.id)}>
                          <i className="bi bi-pencil-fill"></i>
                        </button>
                        <button
                          className="abtn abtn-danger"
                          style={{ padding: '4px 10px', fontSize: '0.72rem', marginLeft: 4 }}
                          disabled={deleting.has(s.id)}
                          onClick={() => deleteRow(s.id)}
                        >
                          {deleting.has(s.id) ? <i className="bi bi-hourglass-split"></i> : <i className="bi bi-trash-fill"></i>}
                        </button>
                        <button
                          className="abtn"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            marginLeft: 4,
                            background: '#f0fdf4',
                            color: '#059669',
                            border: '1.5px solid #bbf7d0',
                          }}
                          title="Copy email template"
                          onClick={() => copyEmailTemplate(s)}
                        >
                          <i className="bi bi-envelope"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              <i className="bi bi-journal-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}></i>
              No submissions yet.
            </div>
          )}
        </div>
      </div>

      {total_pages > 1 && (
        <div className="pagination-bar">
          {page > 1 ? (
            <Link className="pg-btn" href={pageHref(page - 1)}>
              <i className="bi bi-chevron-left"></i>
            </Link>
          ) : (
            <span className="pg-btn disabled">
              <i className="bi bi-chevron-left"></i>
            </span>
          )}

          {winStart > 1 && (
            <>
              <Link className="pg-btn" href={pageHref(1)}>
                1
              </Link>
              {winStart > 2 && <span className="pg-btn disabled">…</span>}
            </>
          )}

          {winPages.map((p) => (
            <Link key={p} className={`pg-btn ${p === page ? 'active' : ''}`} href={pageHref(p)}>
              {p}
            </Link>
          ))}

          {winEnd < total_pages && (
            <>
              {winEnd < total_pages - 1 && <span className="pg-btn disabled">…</span>}
              <Link className="pg-btn" href={pageHref(total_pages)}>
                {total_pages}
              </Link>
            </>
          )}

          {page < total_pages ? (
            <Link className="pg-btn" href={pageHref(page + 1)}>
              <i className="bi bi-chevron-right"></i>
            </Link>
          ) : (
            <span className="pg-btn disabled">
              <i className="bi bi-chevron-right"></i>
            </span>
          )}
        </div>
      )}

      {/* Load from Excel Modal */}
      <div id="lfe-overlay" className={lfeOpen ? 'open' : ''} onClick={(e) => { if (e.target === e.currentTarget) closeLfe(); }}>
        <div style={{ background: '#fff', borderRadius: 14, width: 'min(540px,96vw)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
          <h5 style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.05rem', fontWeight: 800, color: '#1a1f3a', marginBottom: 6 }}>
            <i className="bi bi-file-earmark-arrow-up me-2" style={{ color: '#d97706' }}></i>Load from Excel
          </h5>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 18 }}>
            Select an <strong>.xlsx / .xls</strong> file. Existing records (matched by Submission Name + Date) will be skipped automatically.
          </p>

          {/* Step 1: file picker */}
          <div id="lfe-step-pick" style={{ display: lfeStep === 'pick' ? '' : 'none' }}>
            <div
              id="lfe-drop"
              {...lfeDrop.handlers}
              style={{
                position: 'relative',
                border: `2px dashed ${lfeDrop.st.border}`,
                background: lfeDrop.st.bg,
                borderRadius: 10,
                padding: '24px 28px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color .2s,background .2s',
              }}
            >
              <div id="lfe-empty-state" style={{ pointerEvents: 'none', display: lfeFile ? 'none' : '' }}>
                <i className="bi bi-file-earmark-excel" style={{ fontSize: '2.2rem', color: '#d97706', display: 'block', marginBottom: 8 }}></i>
                <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Click or drag &amp; drop your Excel file here</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>.xlsx or .xls</div>
              </div>
              <div id="lfe-selected-state" style={{ display: lfeFile ? '' : 'none', pointerEvents: 'none' }}>
                <i className="bi bi-file-earmark-check-fill" style={{ fontSize: '2rem', color: '#059669', display: 'block', marginBottom: 8 }}></i>
                <div id="lfe-fname" style={{ fontSize: '0.92rem', color: '#1a1f3a', fontWeight: 700, wordBreak: 'break-all' }}>
                  {lfeFile?.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>Click or drag to replace</div>
              </div>
              <input
                type="file"
                id="lfe-file"
                ref={lfeInput}
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.currentTarget.files && e.currentTarget.files[0];
                  if (f) selectLfe(f);
                }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
            </div>
            <div id="lfe-parse-errors" style={{ display: lfeParseErr ? '' : 'none', marginTop: 10 }}>
              {lfeParseErr}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
              <button onClick={closeLfe} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                id="lfe-preview-btn"
                onClick={lfePreview}
                disabled={lfePreviewDisabled}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#d97706',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: !lfeFile ? 0.5 : lfeChecking ? 0.6 : 1,
                }}
              >
                {lfeChecking ? (
                  <>
                    <i className="bi bi-hourglass-split me-1"></i> Checking…
                  </>
                ) : (
                  <>
                    <i className="bi bi-search me-1"></i> Check File
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: confirmation */}
          <div id="lfe-step-confirm" style={{ display: lfeStep === 'confirm' ? '' : 'none' }}>
            <div id="lfe-summary" style={{ background: '#f8fafc', borderRadius: 10, padding: '16px 20px', marginBottom: 16, fontSize: '0.85rem' }}>
              {lfeSummary && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {[
                      [lfeSummary.total, '#1a1f3a', 'Total Rows'],
                      [lfeSummary.new, '#059669', 'New'],
                      [lfeSummary.existing, '#6b7280', 'Already Exist'],
                    ].map(([v, c, l]: any) => (
                      <div key={l} style={{ textAlign: 'center', padding: 10, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c }}>{v}</div>
                        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  {lfeSummary.existing > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fef3c7', borderRadius: 7, padding: '8px 12px', marginBottom: 10 }}>
                      <i className="bi bi-info-circle me-1"></i> {lfeSummary.existing} record(s) already in the database will be skipped.
                    </div>
                  )}
                  {lfeSummary.parse_errors && lfeSummary.parse_errors.length > 0 && (
                    <div style={{ fontSize: '0.78rem', color: '#991b1b', background: '#fee2e2', borderRadius: 7, padding: '8px 12px', marginBottom: 10 }}>
                      <strong>Parse warnings ({lfeSummary.parse_errors.length}):</strong>
                      <ul style={{ margin: '4px 0 0 16px' }}>
                        {lfeSummary.parse_errors.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
            <div id="lfe-confirm-errors" style={{ display: lfeConfirmMsg ? '' : 'none', marginBottom: 12 }}>
              {lfeConfirmMsg}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
              <button
                onClick={() => setLfeStep('pick')}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                <i className="bi bi-arrow-left me-1"></i> Back
              </button>
              <button
                id="lfe-import-btn"
                onClick={lfeImport}
                disabled={lfeImpDisabled}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#d97706',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: lfeImpDisabled ? (lfeLabel === 'Nothing to Import' && lfeImp === 'idle' ? 0.5 : 0.6) : 1,
                }}
              >
                {lfeImp === 'importing' ? (
                  <>
                    <i className="bi bi-hourglass-split me-1"></i> Importing…
                  </>
                ) : lfeImp === 'done' ? (
                  <>
                    <i className="bi bi-check-circle me-1"></i> Done
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-upload me-1"></i> <span id="lfe-import-label">{lfeLabel}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      <div id="bulk-overlay" className={bulkOpen ? 'open' : ''} onClick={(e) => { if (e.target === e.currentTarget) closeBulk(); }}>
        <div style={{ background: '#fff', borderRadius: 14, width: 'min(540px,96vw)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
          <h5 style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.05rem', fontWeight: 800, color: '#1a1f3a', marginBottom: 6 }}>
            <i className="bi bi-upload me-2" style={{ color: '#7c3aed' }}></i>Bulk Upload from Excel
          </h5>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 18 }}>
            Upload an <strong>.xlsx</strong> file matching the format below. The first row must be headers.
            <br />
            Required columns:{' '}
            <strong>Submission Name, Client, Received Date, Submission Date, QC Checker, Team Name, Check Print, E Sheet Qty, D Sheet Qty, Rating, Remark, Link</strong>.
            <br />
            Date format: <code>YYYY-MM-DD</code> &nbsp;|&nbsp; Check Print: <code>Yes</code> / <code>No</code>.
          </p>
          <div
            id="bulk-drop"
            {...bulkDrop.handlers}
            style={{
              position: 'relative',
              border: `2px dashed ${bulkDrop.st.border}`,
              background: bulkDrop.st.bg,
              borderRadius: 10,
              padding: '24px 28px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color .2s,background .2s',
            }}
          >
            <div id="bulk-empty-state" style={{ pointerEvents: 'none', display: bulkFile ? 'none' : '' }}>
              <i className="bi bi-file-earmark-excel" style={{ fontSize: '2.2rem', color: '#7c3aed', display: 'block', marginBottom: 8 }}></i>
              <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Click or drag &amp; drop your Excel file here</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>.xlsx or .xls</div>
            </div>
            <div id="bulk-selected-state" style={{ display: bulkFile ? '' : 'none', pointerEvents: 'none' }}>
              <i className="bi bi-file-earmark-check-fill" style={{ fontSize: '2rem', color: '#059669', display: 'block', marginBottom: 8 }}></i>
              <div id="bulk-fname" style={{ fontSize: '0.92rem', color: '#1a1f3a', fontWeight: 700, wordBreak: 'break-all' }}>
                {bulkFile?.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>Click or drag to replace</div>
            </div>
            <input
              type="file"
              id="bulk-file"
              ref={bulkInput}
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.currentTarget.files && e.currentTarget.files[0];
                if (f) selectBulk(f);
              }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
          </div>
          <div id="bulk-result" style={{ marginTop: 12, display: bulkResult ? '' : 'none' }}>
            {bulkResult}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
            <button onClick={closeBulk} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              id="bulk-submit-btn"
              onClick={submitBulk}
              disabled={bulkDisabled}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: !bulkFile ? 0.5 : bulkBusy !== 'idle' ? 0.6 : 1,
              }}
            >
              {bulkBusy === 'uploading' ? 'Uploading…' : bulkBusy === 'done' ? 'Done' : 'Upload & Import'}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <div id="edit-overlay" className={editOpen ? 'open' : ''} onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}>
        <div id="edit-modal">
          <h5>
            <i className="bi bi-pencil-square me-2" style={{ color: '#2563eb' }}></i>Edit Submission <span id="em-id-label">{editId !== null ? '#' + editId : ''}</span>
          </h5>
          <form id="edit-form" onSubmit={onEditSubmit}>
            <div className="em-grid">
              <div>
                <label className="em-label">Submission Date</label>
                <input className="em-input" type="date" name="submission_date" id="em-submission_date" value={editForm.submission_date} onChange={setEd('submission_date')} />
              </div>
              <div>
                <label className="em-label">Received Date</label>
                <input className="em-input" type="date" name="received_date" id="em-received_date" value={editForm.received_date} onChange={setEd('received_date')} />
              </div>
              <div>
                <label className="em-label">Team</label>
                <select className="em-input" name="team" id="em-team" value={editForm.team} onChange={setEd('team')}>
                  <option value="">— Select —</option>
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="em-label">QC Checker</label>
                <select className="em-input" name="qc_checker" id="em-qc_checker" value={editForm.qc_checker} onChange={setEd('qc_checker')}>
                  <option value="">— Select —</option>
                  {checkers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="em-label">Client</label>
                <select className="em-input" name="client" id="em-client" value={editForm.client} onChange={setEd('client')}>
                  <option value="">— Select —</option>
                  {clients.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="em-label">Rating</label>
                <select className="em-input" name="rating" id="em-rating" value={editForm.rating} onChange={setEd('rating')}>
                  <option value="">— Select —</option>
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Above Average</option>
                  <option>Average</option>
                  <option>Poor</option>
                </select>
              </div>
              <div className="full">
                <label className="em-label">Job Name</label>
                <input className="em-input" type="text" name="job_name" id="em-job_name" value={editForm.job_name} onChange={setEd('job_name')} />
              </div>
              <div className="full">
                <label className="em-label">Submission Name</label>
                <input className="em-input" type="text" name="submission_name" id="em-submission_name" value={editForm.submission_name} onChange={setEd('submission_name')} />
              </div>
              <div>
                <label className="em-label">E Sheets</label>
                <input className="em-input" type="number" name="num_e_sheets" id="em-num_e_sheets" min="0" value={editForm.num_e_sheets} onChange={setEd('num_e_sheets')} />
              </div>
              <div>
                <label className="em-label">D Sheets</label>
                <input className="em-input" type="number" name="num_d_sheets" id="em-num_d_sheets" min="0" value={editForm.num_d_sheets} onChange={setEd('num_d_sheets')} />
              </div>
              <div>
                <label className="em-label">Check Print</label>
                <select className="em-input" name="check_print" id="em-check_print" value={editForm.check_print} onChange={setEd('check_print')}>
                  <option value="False">No</option>
                  <option value="True">Yes</option>
                </select>
              </div>
              <div>
                <label className="em-label">Submitted By</label>
                <input className="em-input" type="text" name="submitted_by" id="em-submitted_by" value={editForm.submitted_by} onChange={setEd('submitted_by')} />
              </div>
              <div className="full">
                <label className="em-label">Reference Path</label>
                <input className="em-input" type="text" name="main_folder" id="em-main_folder" value={editForm.main_folder} onChange={setEd('main_folder')} />
              </div>
              <div className="full">
                <label className="em-label">Remarks</label>
                <textarea className="em-input" name="remarks" id="em-remarks" rows={2} style={{ resize: 'vertical' }} value={editForm.remarks} onChange={setEd('remarks')} />
              </div>
            </div>
            <div className="em-actions">
              <button
                type="button"
                onClick={closeEdit}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                id="em-save-btn"
                disabled={saveDisabled}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1a1f3a', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {saveLabel}
              </button>
            </div>
          </form>
        </div>
      </div>

      {toast.node}
    </>
  );
}

function SortTh({ col, label, sort, order, onSort }: { col: string; label: string; sort: string; order: string; onSort: (c: string) => void }) {
  const active = sort === col;
  return (
    <th className={active ? (order === 'asc' ? 'sort-asc' : 'sort-desc') : undefined} data-col={col} onClick={() => onSort(col)}>
      {label}
      <span className="sort-icon">{active ? (order === 'asc' ? '↑' : '↓') : '⇅'}</span>
    </th>
  );
}

function FilterBar(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  q: string;
  teams: string[];
  checkers: string[];
  team_filter: string;
  checker_filter: string;
  rating_filter: string;
  countText: React.ReactNode;
}) {
  const { q, teams, checkers, team_filter, checker_filter, rating_filter } = props;
  const submitForm = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();
  return (
    <form id="filter-form" onSubmit={props.onSubmit} className="filter-bar">
      <i className="bi bi-search" style={{ color: '#9ca3af', flexShrink: 0 }}></i>
      <input
        type="text"
        name="q"
        id="sl-search"
        defaultValue={q}
        placeholder="Search name, client, team…"
        style={{ flex: 1, minWidth: 160 }}
      />
      <select name="team" id="sl-team" defaultValue={team_filter} onChange={submitForm}>
        <option value="">All Teams</option>
        {teams.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select name="checker" id="sl-checker" defaultValue={checker_filter} onChange={submitForm}>
        <option value="">All Checkers</option>
        {checkers.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select name="rating" id="sl-rating" defaultValue={rating_filter} onChange={submitForm}>
        <option value="">All Ratings</option>
        <option value="Excellent">Excellent</option>
        <option value="Good">Good</option>
        <option value="Above Average">Above Average</option>
        <option value="Average">Average</option>
        <option value="Poor">Poor</option>
      </select>
      <button
        type="submit"
        style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#1a1f3a', color: '#fff', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <i className="bi bi-search me-1"></i>Search
      </button>
      {(q || team_filter || checker_filter || rating_filter) && (
        <Link
          href="/master-submission/log"
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #fecdd3', background: '#fff1f2', color: '#e11d48', fontSize: '0.82rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          <i className="bi bi-x-lg me-1"></i>Clear
        </Link>
      )}
      <span id="sl-count" style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap', marginLeft: 4 }}>
        {props.countText}
      </span>
    </form>
  );
}

export default function SubmissionLogPageRoute() {
  return (
    <Suspense fallback={null}>
      <SubmissionLogInner />
    </Suspense>
  );
}
