'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { kindFromBg, useToastApi } from '@/context/Toast';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost, qs } from '@/lib/api';
import { useAction } from '@/context/Flash';
import { usePageData } from '@/hooks/usePageData';

const css = `
/* ── Filter bar ───────────────────────────────── */
.filter-bar {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 18px;
    display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;
}
.filter-bar .ff { display: flex; flex-direction: column; gap: 4px; min-width: 130px; flex: 1; }
.filter-bar label {
    font-size: 0.7rem; font-weight: 700; color: #6b7280;
    text-transform: uppercase; letter-spacing: .5px;
}
.filter-bar select, .filter-bar input {
    padding: 7px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
    font-size: 0.83rem; font-family: 'DM Sans', sans-serif; color: #1a1f3a;
    background: #fff;
}
.filter-bar select:focus, .filter-bar input:focus {
    outline: none; border-color: #1a1f3a; box-shadow: 0 0 0 3px rgba(26,31,58,.08);
}
.filter-actions { display: flex; gap: 8px; align-items: flex-end; }

/* ── Table card ───────────────────────────────── */
.ol-table-wrap {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(26,31,58,.04);
}
.ol-table-toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f2f5;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    flex-wrap: wrap;
}
.ol-table-toolbar .toolbar-left {
    display: flex; align-items: center; gap: 10px;
}
.section-divider-th {
    border-left: 2px solid #e5e7eb !important;
}

table.ol-tbl {
    width: 100%; border-collapse: collapse; font-size: 0.83rem;
}
table.ol-tbl thead tr.hdr-labels th {
    font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .5px; color: #9ca3af; padding: 3px 12px 2px;
    background: #fafbfc; border-bottom: none;
}
table.ol-tbl thead tr.hdr-labels th.lbl-qc { color: #059669; border-left: 2px solid #e5e7eb; }
table.ol-tbl thead tr.hdr-cols th {
    background: #f8f9fc;
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.73rem; text-transform: uppercase; letter-spacing: .4px;
    color: #374151; padding: 9px 12px;
    border-bottom: 2px solid #e5e7eb; white-space: nowrap;
}
table.ol-tbl thead tr.hdr-cols th.th-qc {
    border-left: 2px solid #e5e7eb;
}
table.ol-tbl tbody tr {
    border-bottom: 1px solid #f3f4f6;
    transition: background .12s; cursor: pointer;
}
table.ol-tbl tbody tr:nth-child(odd)  { background: #ffffff; }
table.ol-tbl tbody tr:nth-child(even) { background: #eeeeee; }
table.ol-tbl tbody tr:hover { background: #eef2ff !important; }
table.ol-tbl tbody tr:last-child { border-bottom: none; }
table.ol-tbl td { padding: 10px 12px; vertical-align: middle; color: #1a1f3a; }
table.ol-tbl td.td-no {
    font-family: 'Syne', sans-serif; font-weight: 700; color: #d1d5db;
    font-size: 0.75rem; width: 40px; text-align: center;
}
table.ol-tbl td.td-qc { border-left: 2px solid #f0f2f5; }
td.td-project { font-weight: 600; max-width: 220px; }
td.td-project .proj-name {
    display: block; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; max-width: 220px;
}
td.td-project .proj-team {
    display: block; color: #9ca3af; font-size: 0.7rem;
    font-weight: 500; margin-top: 2px;
}

/* ── Status chips ─────────────────────────────── */
.ol-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 9px; border-radius: 20px;
    font-size: 0.71rem; font-weight: 700; white-space: nowrap;
}
.chip-ip        { background: #eff6ff; color: #1d4ed8; }
.chip-completed { background: #f0fdf4; color: #15803d; }
.chip-hold      { background: #fefce8; color: #92400e; }
.chip-pending   { background: #faf5ff; color: #7c3aed; }
.chip-default   { background: #f3f4f6; color: #374151; }
.chip-yes       { background: #f0fdf4; color: #15803d; }
.chip-no        { background: #fef2f2; color: #dc2626; }
.chip-partial   { background: #fefce8; color: #92400e; }

.empty-state-ol {
    text-align: center; padding: 60px 20px; color: #9ca3af;
}
.empty-state-ol i { font-size: 2.5rem; display: block; margin-bottom: 12px; }

/* ── Pagination ──────────────────────────────── */
.ol-pagination {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-top: 1px solid #f0f2f5;
    flex-wrap: wrap; gap: 10px;
}
.pg-info { font-size: 0.78rem; color: #6b7280; font-weight: 500; }
.pg-controls { display: flex; align-items: center; gap: 4px; }
.pg-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 34px; height: 34px; padding: 0 8px;
    border-radius: 8px; border: 1.5px solid #e5e7eb;
    background: #fff; color: #374151;
    font-size: 0.8rem; font-weight: 600;
    text-decoration: none; transition: all .15s; cursor: pointer;
}
.pg-btn:hover:not(.disabled):not(.pg-active) { background: #f3f4f6; border-color: #d1d5db; color: #1a1f3a; }
.pg-btn.pg-active { background: #1a1f3a; color: #fff; border-color: #1a1f3a; }
.pg-btn.disabled { opacity: 0.38; cursor: default; pointer-events: none; }
.pg-ellipsis { font-size: 0.8rem; color: #9ca3af; padding: 0 4px; line-height: 34px; }

/* ── Sortable column headers ─────────────────── */
.sortable-th { white-space: nowrap; }
.sortable-th:hover { background: #eef2ff !important; }
.sortable-th a:hover { color: #1a1f3a !important; }
.sort-icon { font-size: 0.62rem; opacity: 0.3; vertical-align: middle; transition: opacity .15s; }
.sortable-th:hover .sort-icon { opacity: 0.6; }
.sortable-th.sort-asc  .sort-icon,
.sortable-th.sort-desc .sort-icon { opacity: 1; color: #c2410c; }

/* ── QC Done toggle switch (admin) ───────────── */
.qc-toggle-wrap { display: flex; align-items: center; gap: 7px; }
.qc-toggle { position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0; }
.qc-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.qc-slider {
    position: absolute; inset: 0; cursor: pointer;
    background: #d1d5db; border-radius: 22px; transition: background .2s;
}
.qc-slider:before {
    content: ''; position: absolute;
    width: 16px; height: 16px; left: 3px; top: 3px;
    background: #fff; border-radius: 50%; transition: transform .2s;
    box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.qc-toggle input:checked + .qc-slider { background: #059669; }
.qc-toggle input:checked + .qc-slider:before { transform: translateX(16px); }
.qc-toggle-label { font-size: 0.72rem; font-weight: 700; }

/* ── Modal ────────────────────────────────────── */
.ol-modal-backdrop {
    display: none; position: fixed; inset: 0; z-index: 600;
    background: rgba(15,23,42,.45);
    align-items: center; justify-content: center;
    padding: 1rem;
}
.ol-modal-backdrop.open { display: flex; }
.ol-modal {
    background: #fff; border-radius: 16px; width: 100%; max-width: 560px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,.18);
}
.ol-modal-header {
    background: linear-gradient(135deg, #1a1f3a, #2d3561);
    padding: 16px 22px;
    display: flex; align-items: center; justify-content: space-between;
    border-radius: 16px 16px 0 0;
}
.ol-modal-header h3 {
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.95rem; color: #fff; margin: 0;
}
.modal-close-btn {
    background: rgba(255,255,255,.15); border: none; color: #fff;
    border-radius: 8px; padding: 5px 10px; font-size: 0.95rem; cursor: pointer;
}
.modal-close-btn:hover { background: rgba(255,255,255,.25); }
.ol-modal-body { padding: 22px; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-grid-1 { display: grid; grid-template-columns: 1fr; gap: 14px; }
.ff { display: flex; flex-direction: column; gap: 5px; }
.ff label { font-size: 0.75rem; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .4px; }
.ff label .req { color: #e84c4c; }
.fctrl {
    width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb;
    border-radius: 9px; font-size: 0.84rem;
    font-family: 'DM Sans', sans-serif; color: #1a1f3a; background: #fff;
}
.fctrl:focus { outline: none; border-color: #1a1f3a; box-shadow: 0 0 0 3px rgba(26,31,58,.08); }
.ol-modal-footer {
    padding: 14px 22px; border-top: 1px solid #f0f2f5;
    background: #fafbfc; display: flex; gap: 8px; justify-content: flex-end;
    border-radius: 0 0 16px 16px;
}

/* ── Upload area ─────────────────────────────── */
.upload-area {
    border: 2px dashed #d1d5db; border-radius: 12px;
    padding: 28px; text-align: center; cursor: pointer;
    transition: border-color .2s, background .2s;
}
.upload-area:hover, .upload-area.drag { border-color: #1a1f3a; background: #f8f9fc; }
.upload-area i { font-size: 2rem; color: #9ca3af; display: block; margin-bottom: 8px; }
.upload-area .ua-label { font-weight: 600; color: #374151; font-size: 0.88rem; }
.upload-area .ua-hint { font-size: 0.76rem; color: #9ca3af; margin-top: 4px; }
#uploadFileName { font-size: 0.8rem; color: #10b981; margin-top: 8px; font-weight: 600; }

/* ── Btn helpers ─────────────────────────────── */
.btn-dark-sm {
    display: inline-flex; align-items: center; gap: 6px;
    background: #1a1f3a; color: #fff;
    padding: 8px 16px; border-radius: 9px;
    font-size: 0.82rem; font-weight: 600;
    border: none; cursor: pointer; text-decoration: none;
    transition: background .15s;
}
.btn-dark-sm:hover { background: #2d3561; color: #fff; }
.btn-outline-sm {
    display: inline-flex; align-items: center; gap: 6px;
    background: #fff; color: #374151;
    padding: 8px 14px; border-radius: 9px;
    font-size: 0.82rem; font-weight: 600;
    border: 1.5px solid #e5e7eb; cursor: pointer; text-decoration: none;
    transition: background .15s;
}
.btn-outline-sm:hover { background: #f3f4f6; color: #1a1f3a; }
.btn-success-sm {
    display: inline-flex; align-items: center; gap: 6px;
    background: #059669; color: #fff;
    padding: 8px 16px; border-radius: 9px;
    font-size: 0.82rem; font-weight: 600;
    border: none; cursor: pointer; text-decoration: none;
    transition: background .15s;
}
.btn-success-sm:hover { background: #047857; color: #fff; }

/* ── Import result box ───────────────────────── */
#importResult {
    border-radius: 10px; padding: 12px 16px;
    font-size: 0.82rem; margin-top: 14px; display: none;
}

/* ── Load Data modal (wider) ─────────────────── */
.ol-modal-lg { max-width: 760px; }

.ld-result-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px;
}
.ld-result-title {
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.88rem; color: #1a1f3a;
    display: flex; align-items: center; gap: 8px;
}
.ld-count-badge {
    background: #1a1f3a; color: #fff;
    border-radius: 12px; padding: 2px 10px;
    font-size: 0.72rem; font-weight: 700;
}
.ld-record-list {
    border: 1.5px solid #e5e7eb; border-radius: 10px;
    max-height: 360px; overflow-y: auto;
}
.ld-record-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px; border-bottom: 1px solid #f3f4f6;
    transition: background .12s;
}
.ld-record-item:last-child { border-bottom: none; }
.ld-record-item:hover { background: #f8f9fc; }
.ldr-no {
    font-family: 'Syne', sans-serif; font-weight: 700;
    color: #d1d5db; font-size: 0.75rem; width: 22px;
    text-align: center; flex-shrink: 0;
}
.ldr-info { flex: 1; min-width: 0; }
.ldr-name {
    font-weight: 600; font-size: 0.84rem; color: #1a1f3a;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ldr-meta {
    display: flex; gap: 10px; margin-top: 3px; flex-wrap: wrap;
}
.ldr-meta span { font-size: 0.72rem; color: #6b7280; }
.btn-add-ld {
    display: inline-flex; align-items: center; gap: 5px;
    background: #f0fdf4; color: #059669;
    padding: 5px 12px; border-radius: 7px;
    font-size: 0.78rem; font-weight: 700;
    border: 1.5px solid #a7f3d0; cursor: pointer;
    white-space: nowrap; flex-shrink: 0; transition: all .15s;
}
.btn-add-ld:hover:not(:disabled) { background: #059669; color: #fff; border-color: #059669; }
.btn-add-ld:disabled { opacity: .5; cursor: not-allowed; }
.ld-empty-hint { text-align: center; padding: 32px 20px; }
.ld-scan-status {
    font-size: 0.82rem; color: #374151; margin: 10px 0; display: none;
}
.ld-info-bar {
    background: #f8f9fc; border-radius: 8px; padding: 8px 14px;
    font-size: 0.78rem; color: #6b7280; margin-bottom: 14px;
}
`;

const DASH = <span style={{ color: '#d1d5db' }}>—</span>;

function OwnershipLogInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const run = useAction();
  const query = sp.toString();
  const { data, reload } = usePageData<any>('/api/pages/ownership-log' + (query ? '?' + query : ''));

  /* ── Modals ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateOpen(false);
        setBulkOpen(false);
        setLoadOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── Toast ── */
  const toastApi = useToastApi();
  const showOlToast = useCallback((msg: string, bg?: string) => toastApi.show(kindFromBg(bg), msg), [toastApi]);

  /* ── Bulk upload ── */
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importDisabled, setImportDisabled] = useState(true);
  const [importResult, setImportResult] = useState<any>(null);
  const reloadTimer = useRef<any>(null);
  useEffect(() => () => clearTimeout(reloadTimer.current), []);

  const submitImport = async () => {
    if (!file) return;
    setImportDisabled(true);
    setImportBusy(true);
    const fd = new FormData();
    fd.append('excel_file', file);
    const d = await apiPost('/api/actions/ownership-log/import-excel', fd);
    if (d.status === 0) {
      setImportDisabled(false);
      setImportBusy(false);
      return;
    }
    if (d.ok) {
      setImportResult(d);
      reloadTimer.current = setTimeout(() => window.location.reload(), 1800);
    } else {
      setImportResult(d);
      setImportDisabled(false);
      setImportBusy(false);
    }
  };

  /* ── Load Data ── */
  const ldFileRef = useRef<HTMLInputElement>(null);
  const [ldDrag, setLdDrag] = useState(false);
  const [ldFileName, setLdFileName] = useState('');
  const [ldStatus, setLdStatus] = useState<{ kind: 'scan' | 'error'; text: string } | null>(null);
  const [ldRecords, setLdRecords] = useState<any[]>([]); // null entries = already added
  const [ldSummary, setLdSummary] = useState<{ totalExcel: number; existingCount: number; newCount: number } | null>(null);
  const [ldRow, setLdRow] = useState<Record<number, 'adding' | 'added' | 'fading' | 'gone'>>({});
  const [ldAddAllBusy, setLdAddAllBusy] = useState(false);
  const [ldAllDone, setLdAllDone] = useState<{ inserted: number; errors: string[] } | null>(null);
  const isDone = (i: number) => ldRow[i] === 'added' || ldRow[i] === 'fading' || ldRow[i] === 'gone';
  const ldPending = ldRecords.filter((r, i) => r && !isDone(i));
  const ldRemaining = ldPending.length;

  const closeLoadDataModal = () => {
    setLoadOpen(false);
    setLdRecords([]);
    if (ldFileRef.current) ldFileRef.current.value = '';
    setLdFileName('');
    setLdStatus(null);
    setLdSummary(null);
    setLdRow({});
    setLdAllDone(null);
    setLdAddAllBusy(false);
  };

  const ldScanExcel = async (f: File) => {
    setLdStatus({ kind: 'scan', text: 'Scanning file and comparing with database…' });
    setLdSummary(null);
    setLdRecords([]);
    setLdRow({});
    setLdAllDone(null);
    const fd = new FormData();
    fd.append('excel_file', f);
    const data = await apiPost('/api/actions/ownership-log/preview-new-records', fd);
    if (data.status === 0) {
      setLdStatus({ kind: 'error', text: 'Network error. Please try again.' });
      return;
    }
    if (!data.ok) {
      setLdStatus({ kind: 'error', text: String(data.error || '') });
      return;
    }
    setLdStatus(null);
    const recs = (data.new_records || []).slice();
    setLdRecords(recs);
    setLdSummary({ totalExcel: data.total_excel, existingCount: data.existing_count, newCount: recs.filter((r: any) => r).length });
  };

  const ldSetFile = (f: File) => {
    setLdFileName(f.name);
    ldScanExcel(f);
  };

  const ldAddOne = async (idx: number) => {
    const rec = ldRecords[idx];
    if (!rec) return;
    setLdRow((s) => ({ ...s, [idx]: 'adding' }));
    const resetBtn = () =>
      setLdRow((s) => {
        const n = { ...s };
        delete n[idx];
        return n;
      });
    const data = await apiPost('/api/actions/ownership-log/add-records-json', { records: [rec] });
    if (data.status === 0) {
      resetBtn();
      alert('Network error. Please try again.');
      return;
    }
    if (data.ok && data.inserted > 0) {
      setLdRow((s) => ({ ...s, [idx]: 'added' }));
      setTimeout(() => {
        setLdRow((s) => ({ ...s, [idx]: 'fading' }));
        setTimeout(() => setLdRow((s) => ({ ...s, [idx]: 'gone' })), 300);
      }, 1200);
      if (ldPending.length - 1 <= 0) reloadTimer.current = setTimeout(() => window.location.reload(), 1000);
    } else {
      resetBtn();
      alert((data.errors && data.errors[0]) || 'Failed to add record.');
    }
  };

  const ldAddAll = async () => {
    const remaining = ldPending;
    if (!remaining.length) return;
    setLdAddAllBusy(true);
    const data = await apiPost('/api/actions/ownership-log/add-records-json', { records: remaining });
    if (data.status === 0) {
      setLdAddAllBusy(false);
      alert('Network error. Please try again.');
      return;
    }
    if (data.ok) {
      setLdRecords([]);
      setLdAllDone({ inserted: data.inserted, errors: data.errors || [] });
      reloadTimer.current = setTimeout(() => window.location.reload(), 1500);
    } else {
      setLdAddAllBusy(false);
      alert(data.error || 'Failed to add records.');
    }
  };

  /* ── QC Done toggle (admin only) ── */
  const [qcOverride, setQcOverride] = useState<Record<number, string>>({});
  const toggleQcDone = async (ms: any, checked: boolean) => {
    const newVal = checked ? 'Yes' : 'No';
    if (!confirm(`Mark QC Done as "${newVal}"?`)) return; // controlled checkbox: nothing to revert
    const d = await apiPost(`/api/ownership-log/${ms.id}/qc-done`, { qc_done: newVal });
    if (d.status === 0) {
      alert('Network error, please try again.');
      return;
    }
    if (!d.ok) {
      alert(d.error || 'Update failed');
      return;
    }
    setQcOverride((o) => ({ ...o, [ms.id]: newVal }));
  };

  /* ── Multi-select delete ── */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setSelected(new Set());
    setQcOverride({});
    setDeleting(false);
  }, [data]);
  const rows: any[] = data?.rows || [];
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && selected.size < rows.length;
    }
  }, [selected, rows.length]);

  const toggleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  };
  const toggleRow = (id: number, checked: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} selected record(s)? This cannot be undone.`)) return;
    const ids = Array.from(selected).map((c) => parseInt(String(c)));
    setDeleting(true);
    const d = await apiPost('/api/actions/ownership-log/delete-multiple', { ids });
    if (d.status === 0) {
      alert('Network error. Please try again.');
      setDeleting(false);
    } else if (d.ok) {
      reload();
    } else {
      alert(d.error || 'Delete failed.');
      setDeleting(false);
    }
  };

  /* ── Open folder / copy path on error ── */
  const olFallbackCopy = (path: string) => {
    const ta = document.createElement('textarea');
    ta.value = path;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      showOlToast('Path copied to clipboard: ' + path, '#1a1f3a');
    } catch (e) {
      showOlToast('Could not open or copy path', '#e11d48');
    }
    document.body.removeChild(ta);
  };
  const copyOlPath = (path: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(path)
        .then(() => showOlToast('Path copied to clipboard: ' + path, '#1a1f3a'))
        .catch(() => olFallbackCopy(path));
    } else {
      olFallbackCopy(path);
    }
  };
  const openOlFolder = async (path: string) => {
    const d = await apiPost('/api/actions/open-folder', { path });
    if (!d.ok) copyOlPath(path);
  };

  /* ── Create form ── */
  const onCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await run('POST', '/api/actions/ownership-log/add', new FormData(e.currentTarget));
  };

  /* ── Filter form (GET on same page) ── */
  const onFilterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    fd.forEach((v, k) => p.append(k, String(v)));
    router.push('/ownership-log?' + p.toString());
  };

  if (!data) {
    return <style>{css}</style>;
  }

  const {
    q, flt_domain, flt_client, flt_status, flt_qc_done, flt_team,
    all_domains = [], all_clients = [], all_statuses = [], all_teams = [], all_projects = [], checkers = [],
    is_admin, page, total_pages, total, per_page, sort_col, sort_dir,
  } = data;

  const olHref = (o: Record<string, any>) =>
    '/ownership-log' +
    qs({ q, domain: flt_domain, client: flt_client, status: flt_status, qc_done: flt_qc_done, team: flt_team, ...o });

  const filtered = !!(q || flt_domain || flt_client || flt_status || flt_qc_done || flt_team);

  const sortTh = (label: string, col: string, extraClass = '') => {
    const ndir = sort_col === col && sort_dir === 'desc' ? 'asc' : sort_col === col ? 'desc' : 'asc';
    return (
      <th className={`sortable-th ${extraClass} ${sort_col === col ? 'sort-' + sort_dir : ''}`}>
        <Link
          href={olHref({ sort_col: col, sort_dir: ndir, page: 1 })}
          style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}
        >
          {label}
          <span className="sort-icon">
            <i className={`bi ${sort_col === col ? (sort_dir === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up'}`}></i>
          </span>
        </Link>
      </th>
    );
  };

  const statusChip = (st: string) => {
    const s = st.toLowerCase();
    if (s.includes('progress')) return <span className="ol-chip chip-ip"><i className="bi bi-arrow-repeat"></i>{st}</span>;
    if (s.includes('complet')) return <span className="ol-chip chip-completed"><i className="bi bi-check-circle-fill"></i>{st}</span>;
    if (s.includes('hold')) return <span className="ol-chip chip-hold"><i className="bi bi-pause-circle-fill"></i>{st}</span>;
    if (s.includes('pending')) return <span className="ol-chip chip-pending"><i className="bi bi-clock-fill"></i>{st}</span>;
    return <span className="ol-chip chip-default">{st}</span>;
  };

  const pageLinks: any[] = [];
  if (total_pages > 1) {
    let last = 0;
    for (let p = 1; p <= total_pages; p++) {
      if (p === 1 || p === total_pages || (p >= page - 2 && p <= page + 2)) {
        if (last !== 0 && p - last > 1) pageLinks.push(<span key={'e' + p} className="pg-ellipsis">…</span>);
        pageLinks.push(
          <Link key={p} href={olHref({ sort_col, sort_dir, page: p })} className={`pg-btn${p === page ? ' pg-active' : ''}`}>{p}</Link>
        );
        last = p;
      }
    }
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const STATUS_OPTS = ['AB & EMBED DONE', 'AB OFA COMPLETED', 'CUSTOMER DROPPED', 'FAB COMPLETED', 'HOLD', 'IFF COMPLETED', 'IFF DONE', 'OFA COMPLETED', 'OFA DONE', 'OFA PROGRESSING', 'PARTIAL DONE'];
  const XL_COLS = ['Project Name', 'Domain', 'Client', 'QC Checker', 'Team', 'Received Date', 'Working Days', 'Status', 'QC Done', 'Done By', 'Remarks'];

  return (
    <>
      <title>Ownership Log – QAQC</title>
      <style>{css}</style>

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-clipboard2-data me-2" style={{ color: '#1a1f3a' }}></i>Ownership Log
          </h1>
          <p className="page-subtitle">Project ownership &amp; QC calendar — 2026</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 20, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600 }}>
            {total} record{total !== 1 ? 's' : ''}
          </span>
          <button className="btn-outline-sm" onClick={() => setLoadOpen(true)}>
            <i className="bi bi-database-add"></i> Load Data
          </button>
          <button className="btn-outline-sm" onClick={() => setBulkOpen(true)}>
            <i className="bi bi-file-earmark-arrow-up"></i> Bulk Upload
          </button>
          <button className="btn-dark-sm" onClick={() => setCreateOpen(true)}>
            <i className="bi bi-plus-lg"></i> New Record
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <form key={query} method="GET" action="/ownership-log" onSubmit={onFilterSubmit}>
        <div className="filter-bar">
          <div className="ff" style={{ flex: 2, minWidth: 170 }}>
            <label><i className="bi bi-search me-1"></i>Search</label>
            <input type="text" name="q" defaultValue={q} placeholder="Project name, client, QC…" />
          </div>
          <div className="ff">
            <label>Domain</label>
            <select name="domain" defaultValue={flt_domain}>
              <option value="">All Domains</option>
              {all_domains.map((d: string) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="ff">
            <label>Client</label>
            <select name="client" defaultValue={flt_client}>
              <option value="">All Clients</option>
              {all_clients.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="ff">
            <label>Status</label>
            <select name="status" defaultValue={flt_status}>
              <option value="">All Statuses</option>
              {all_statuses.map((s: string) => <option key={s} value={s}>{s}</option>)}
              {!all_statuses.length && (
                <>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Pending Review">Pending Review</option>
                </>
              )}
            </select>
          </div>
          <div className="ff">
            <label>QC Done?</label>
            <select name="qc_done" defaultValue={flt_qc_done}>
              <option value="">All</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="Partial">Partial</option>
            </select>
          </div>
          <div className="ff">
            <label>Team</label>
            <select name="team" defaultValue={flt_team}>
              <option value="">All Teams</option>
              {all_teams.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input type="hidden" name="sort_col" value={sort_col} />
          <input type="hidden" name="sort_dir" value={sort_dir} />
          <div className="filter-actions">
            <button type="submit" className="btn-dark-sm" style={{ padding: '7px 16px' }}>
              <i className="bi bi-funnel"></i> Filter
            </button>
            <Link href="/ownership-log" className="btn-outline-sm" style={{ padding: '7px 12px' }}>
              <i className="bi bi-x-lg"></i>
            </Link>
          </div>
        </div>
      </form>

      {/* ── Table ── */}
      <div className="ol-table-wrap">
        <div className="ol-table-toolbar">
          <div className="toolbar-left">
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.85rem', color: '#1a1f3a' }}>
              All Records
            </span>
            {filtered && (
              <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                filtered
              </span>
            )}
            {is_admin && (
              <button
                id="deleteSelectedBtn"
                className="btn-outline-sm"
                style={{ display: selected.size > 0 ? 'inline-flex' : 'none', padding: '5px 12px', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                disabled={deleting}
                onClick={deleteSelected}
              >
                {deleting ? (
                  <><i className="bi bi-hourglass-split"></i> Deleting…</>
                ) : (
                  <><i className="bi bi-trash3"></i> Delete Selected (<span id="selectedCount">{selected.size}</span>)</>
                )}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link
              href={olHref({ sort_col: 'id', sort_dir: sort_col === 'id' && sort_dir === 'desc' ? 'asc' : 'desc', page: 1 })}
              title={sort_dir === 'desc' ? 'Oldest first' : 'Newest first'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 600, color: '#374151', textDecoration: 'none', padding: '4px 10px', background: '#f3f4f6', borderRadius: 6, border: '1px solid #e5e7eb' }}
            >
              {sort_col === 'id' && sort_dir === 'desc' ? (
                <><i className="bi bi-sort-numeric-up"></i> Oldest First</>
              ) : (
                <><i className="bi bi-sort-numeric-down"></i> Newest First</>
              )}
            </Link>
            <a
              href="/api/actions/ownership-log/template"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 600, color: '#059669', textDecoration: 'none', padding: '4px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #a7f3d0' }}
            >
              <i className="bi bi-file-earmark-excel"></i> Download Template
            </a>
          </div>
        </div>

        {rows.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="ol-tbl">
                <thead>
                  <tr className="hdr-labels">
                    {is_admin && <th></th>}
                    <th colSpan={5}>Ownership – Project Details</th>
                    <th colSpan={4} className="lbl-qc">QC Calendar – Status &amp; Completion</th>
                    <th></th>
                  </tr>
                  <tr className="hdr-cols">
                    {is_admin && (
                      <th style={{ width: 36, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          id="selectAllCb"
                          ref={selectAllRef}
                          title="Select all"
                          style={{ cursor: 'pointer', width: 15, height: 15 }}
                          checked={allSelected}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </th>
                    )}
                    <th style={{ width: 40, textAlign: 'center' }}>No</th>
                    {sortTh('Project Name', 'job_name')}
                    {sortTh('Domain', 'domain')}
                    {sortTh('Client', 'client')}
                    {sortTh('QC', 'qc_checker')}
                    {sortTh('Status', 'ol_status', 'th-qc')}
                    {sortTh('QC Done?', 'qc_done', 'th-qc')}
                    {sortTh('Done By (QC)', 'done_by', 'th-qc')}
                    {sortTh('Remarks', 'ol_remarks', 'th-qc')}
                    <th style={{ width: 52 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ms: any, idx: number) => {
                    const qcDone = qcOverride[ms.id] !== undefined ? qcOverride[ms.id] : ms.qc_done;
                    return (
                      <tr key={ms.id} onClick={() => router.push(`/master-set/${ms.id}?ref=ol`)}>
                        {is_admin && (
                          <td style={{ textAlign: 'center', padding: '6px 8px' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="ol-row-cb"
                              data-id={ms.id}
                              style={{ cursor: 'pointer', width: 15, height: 15 }}
                              checked={selected.has(ms.id)}
                              onChange={(e) => toggleRow(ms.id, e.target.checked)}
                            />
                          </td>
                        )}
                        <td className="td-no">{(page - 1) * per_page + idx + 1}</td>
                        <td className="td-project">
                          <span className="proj-name" title={ms.job_name}>{ms.job_name}</span>
                          {ms.team && (
                            <span className="proj-team"><i className="bi bi-people-fill me-1"></i>{ms.team}</span>
                          )}
                        </td>
                        <td>{ms.domain || DASH}</td>
                        <td>{ms.client || DASH}</td>
                        <td>{ms.qc_checker || DASH}</td>
                        <td className="td-qc">{ms.ol_status ? statusChip(ms.ol_status) : DASH}</td>
                        <td className="td-qc" onClick={(e) => e.stopPropagation()}>
                          {is_admin ? (
                            <div className="qc-toggle-wrap">
                              <label className="qc-toggle" title="Toggle QC Done">
                                <input
                                  type="checkbox"
                                  checked={qcDone === 'Yes'}
                                  data-ms-id={ms.id}
                                  data-current={qcDone || ''}
                                  onChange={(e) => toggleQcDone(ms, e.target.checked)}
                                />
                                <span className="qc-slider"></span>
                              </label>
                              <span
                                className={`qc-toggle-label ${
                                  qcDone === 'Yes' ? 'text-success' : qcDone === 'No' ? 'text-danger' : qcDone === 'Partial' ? 'text-warning' : 'text-muted'
                                }`}
                              >
                                {qcDone || '—'}
                              </span>
                            </div>
                          ) : qcDone === 'Yes' ? (
                            <span className="ol-chip chip-yes"><i className="bi bi-check-circle-fill"></i>Yes</span>
                          ) : qcDone === 'No' ? (
                            <span className="ol-chip chip-no"><i className="bi bi-x-circle-fill"></i>No</span>
                          ) : qcDone === 'Partial' ? (
                            <span className="ol-chip chip-partial"><i className="bi bi-dash-circle-fill"></i>Partial</span>
                          ) : (
                            DASH
                          )}
                        </td>
                        <td className="td-qc">{ms.done_by || DASH}</td>
                        <td className="td-qc" style={{ maxWidth: 180 }}>
                          <span
                            style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}
                            title={ms.ol_remarks}
                          >
                            {ms.ol_remarks || DASH}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 8px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          {ms.folder_path && (
                            <button
                              type="button"
                              data-path={ms.folder_path}
                              title={ms.folder_path}
                              onClick={() => openOlFolder(ms.folder_path)}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, marginRight: 4, background: '#f0fdf4', color: '#059669', border: '1.5px solid #bbf7d0', cursor: 'pointer', transition: 'all .15s' }}
                              onMouseOver={(e) => { const s = e.currentTarget.style; s.background = '#059669'; s.color = '#fff'; s.borderColor = '#059669'; }}
                              onMouseOut={(e) => { const s = e.currentTarget.style; s.background = '#f0fdf4'; s.color = '#059669'; s.borderColor = '#bbf7d0'; }}
                            >
                              <i className="bi bi-folder2-open" style={{ fontSize: '0.72rem' }}></i>
                            </button>
                          )}
                          <Link
                            href={`/ownership-log/${ms.id}`}
                            title="Edit ownership record"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, background: '#f3f4f6', color: '#374151', border: '1.5px solid #e5e7eb', textDecoration: 'none', transition: 'all .15s' }}
                            onMouseOver={(e) => { const s = e.currentTarget.style; s.background = '#1a1f3a'; s.color = '#fff'; s.borderColor = '#1a1f3a'; }}
                            onMouseOut={(e) => { const s = e.currentTarget.style; s.background = '#f3f4f6'; s.color = '#374151'; s.borderColor = '#e5e7eb'; }}
                          >
                            <i className="bi bi-pencil-fill" style={{ fontSize: '0.72rem' }}></i>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {total_pages > 1 && (
              <div className="ol-pagination">
                <span className="pg-info">
                  Showing {(page - 1) * per_page + 1}–{Math.min(page * per_page, total)} of {total} records
                </span>
                <div className="pg-controls">
                  {page > 1 ? (
                    <Link href={olHref({ sort_col, sort_dir, page: page - 1 })} className="pg-btn" title="Previous">
                      <i className="bi bi-chevron-left"></i>
                    </Link>
                  ) : (
                    <span className="pg-btn disabled"><i className="bi bi-chevron-left"></i></span>
                  )}
                  {pageLinks}
                  {page < total_pages ? (
                    <Link href={olHref({ sort_col, sort_dir, page: page + 1 })} className="pg-btn" title="Next">
                      <i className="bi bi-chevron-right"></i>
                    </Link>
                  ) : (
                    <span className="pg-btn disabled"><i className="bi bi-chevron-right"></i></span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state-ol">
            <i className="bi bi-clipboard2-x"></i>
            <div style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>No records found</div>
            <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>
              {filtered && <>Try clearing your filters, or </>}
              <button
                onClick={() => setCreateOpen(true)}
                style={{ background: 'none', border: 'none', color: '#1a1f3a', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.82rem' }}
              >
                create a new record
              </button>.
            </div>
          </div>
        )}
      </div>

      {/* ══ CREATE MODAL ══ */}
      <div className={`ol-modal-backdrop${createOpen ? ' open' : ''}`} id="createModal" onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
        <div className="ol-modal">
          <div className="ol-modal-header">
            <h3><i className="bi bi-plus-circle me-2"></i>New Ownership Record</h3>
            <button className="modal-close-btn" onClick={() => setCreateOpen(false)}><i className="bi bi-x-lg"></i></button>
          </div>
          <form method="POST" onSubmit={onCreateSubmit}>
            <div className="ol-modal-body">
              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <div className="ff" style={{ gridColumn: 'span 2' }}>
                  <label>Project Name <span className="req">*</span></label>
                  <input type="text" name="job_name" className="fctrl" list="jobListOL" placeholder="e.g. 21843_South College…" required autoComplete="off" />
                  <datalist id="jobListOL">
                    {all_projects.map((p: string) => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div className="ff">
                  <label>Domain</label>
                  <input type="text" name="domain" className="fctrl" list="domainListOL" placeholder="e.g. Structural…" autoComplete="off" />
                  <datalist id="domainListOL">
                    {all_domains.map((d: string) => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div className="ff">
                  <label>Client</label>
                  <input type="text" name="client" className="fctrl" list="clientListOL" placeholder="Client name…" autoComplete="off" />
                  <datalist id="clientListOL">
                    {all_clients.map((c: string) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="ff">
                  <label>QC Checker</label>
                  <input type="text" name="qc_checker" className="fctrl" list="checkerListOL" placeholder="Assigned checker…" autoComplete="off" />
                  <datalist id="checkerListOL">
                    {checkers.map((c: string) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="ff">
                  <label>Team</label>
                  <input type="text" name="team" className="fctrl" list="teamListOL" placeholder="Team name…" autoComplete="off" />
                  <datalist id="teamListOL">
                    {all_teams.map((t: string) => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div className="ff">
                  <label>Received Date</label>
                  <input type="date" name="received_date" className="fctrl" />
                </div>
                <div className="ff">
                  <label>Working Days</label>
                  <input type="number" name="working_days" className="fctrl" min={1} placeholder="e.g. 3" />
                </div>
                <div className="ff">
                  <label>Status</label>
                  <input type="text" name="ol_status" className="fctrl" list="statusListCreate" placeholder="Select or type…" autoComplete="off" />
                  <datalist id="statusListCreate">
                    {STATUS_OPTS.map((opt) => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
                <div className="ff">
                  <label>QC Done?</label>
                  <select name="qc_done" className="fctrl">
                    <option value="">— Select —</option>
                    <option>Yes</option><option>No</option><option>Partial</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="ol-modal-footer">
              <button type="button" className="btn-outline-sm" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="submit" className="btn-dark-sm"><i className="bi bi-check-lg"></i> Create</button>
            </div>
          </form>
        </div>
      </div>

      {/* ══ BULK UPLOAD MODAL ══ */}
      <div className={`ol-modal-backdrop${bulkOpen ? ' open' : ''}`} id="bulkUploadModal" onClick={(e) => { if (e.target === e.currentTarget) setBulkOpen(false); }}>
        <div className="ol-modal">
          <div className="ol-modal-header">
            <h3><i className="bi bi-file-earmark-arrow-up me-2"></i>Bulk Upload from Excel</h3>
            <button className="modal-close-btn" onClick={() => setBulkOpen(false)}><i className="bi bi-x-lg"></i></button>
          </div>
          <div className="ol-modal-body">
            <div style={{ background: '#f8f9fc', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: '0.82rem', color: '#374151' }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#1a1f3a' }}>
                <i className="bi bi-info-circle me-1" style={{ color: '#3b82f6' }}></i>Expected columns (row 1 = headers):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {XL_COLS.map((col) => (
                  <span key={col} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>{col}</span>
                ))}
              </div>
              <div style={{ marginTop: 8, color: '#6b7280', fontSize: '0.76rem' }}>
                Download the template below, fill it in and re-upload. Only <b>.xlsx</b> or <b>.xls</b> accepted.
              </div>
            </div>

            <a
              href="/api/actions/ownership-log/template"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: '#059669', textDecoration: 'none', marginBottom: 14, padding: '7px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #a7f3d0' }}
            >
              <i className="bi bi-file-earmark-excel"></i> Download Excel Template
            </a>

            <div
              className={`upload-area${dragOver ? ' drag' : ''}`}
              id="uploadDropZone"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) {
                  try {
                    const dt = new DataTransfer();
                    dt.items.add(f);
                    if (fileRef.current) fileRef.current.files = dt.files;
                  } catch {}
                  setFile(f);
                  setImportDisabled(false);
                }
              }}
            >
              <i className="bi bi-cloud-arrow-up"></i>
              <div className="ua-label">Click to choose file or drag &amp; drop</div>
              <div className="ua-hint">.xlsx or .xls only</div>
              <div id="uploadFileName">{file ? file.name : ''}</div>
            </div>
            <input
              type="file"
              id="olExcelFile"
              ref={fileRef}
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setImportDisabled(false);
                }
              }}
            />

            <div
              id="importResult"
              style={
                importResult
                  ? importResult.ok
                    ? { display: 'block', background: '#f0fdf4', border: '1px solid #a7f3d0', color: '#065f46' }
                    : { display: 'block', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }
                  : undefined
              }
            >
              {importResult && importResult.ok && (
                <>
                  <b><i className="bi bi-check-circle-fill me-1"></i>Import complete</b> —
                  {' '}{importResult.inserted} record(s) inserted, {importResult.skipped} skipped.
                  {importResult.errors && importResult.errors.length > 0 && (
                    <>
                      <br />
                      <span style={{ color: '#92400e' }}>Warnings: {importResult.errors.join('; ')}</span>
                    </>
                  )}
                </>
              )}
              {importResult && !importResult.ok && (
                <>
                  <b><i className="bi bi-x-circle-fill me-1"></i>Error:</b> {importResult.error}
                </>
              )}
            </div>
          </div>
          <div className="ol-modal-footer">
            <button type="button" className="btn-outline-sm" onClick={() => setBulkOpen(false)}>Close</button>
            <button className="btn-success-sm" id="importBtn" onClick={submitImport} disabled={importDisabled}>
              {importBusy ? (
                <><i className="bi bi-hourglass-split"></i> Importing…</>
              ) : (
                <><i className="bi bi-upload"></i> Upload &amp; Import</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ══ LOAD DATA MODAL ══ */}
      <div
        className={`ol-modal-backdrop${loadOpen ? ' open' : ''}`}
        id="loadDataModal"
        onClick={(e) => { if (e.target === e.currentTarget) closeLoadDataModal(); }}
      >
        <div className="ol-modal ol-modal-lg">
          <div className="ol-modal-header">
            <h3><i className="bi bi-database-add me-2"></i>Load New Data from Excel</h3>
            <button className="modal-close-btn" onClick={closeLoadDataModal}><i className="bi bi-x-lg"></i></button>
          </div>
          <div className="ol-modal-body">
            <div className="ld-info-bar">
              <i className="bi bi-info-circle me-1" style={{ color: '#3b82f6' }}></i>
              Select the Excel file you previously uploaded. Only records <b>not already in the database</b>
              {' '}(matched by Project Name) will be shown below for selective import.
            </div>

            <div
              className={`upload-area${ldDrag ? ' drag' : ''}`}
              id="ldDropZone"
              onClick={() => ldFileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setLdDrag(true); }}
              onDragLeave={() => setLdDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setLdDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) {
                  try {
                    const dt = new DataTransfer();
                    dt.items.add(f);
                    if (ldFileRef.current) ldFileRef.current.files = dt.files;
                  } catch {}
                  ldSetFile(f);
                }
              }}
            >
              <i className="bi bi-file-earmark-spreadsheet"></i>
              <div className="ua-label">Click to choose file or drag &amp; drop</div>
              <div className="ua-hint">.xlsx or .xls — compares with existing DB records</div>
              <div id="ldFileName">{ldFileName}</div>
            </div>
            <input
              type="file"
              id="ldExcelFile"
              ref={ldFileRef}
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) ldSetFile(f); }}
            />

            <div
              className="ld-scan-status"
              id="ldScanStatus"
              style={ldStatus ? { display: 'block', color: ldStatus.kind === 'error' ? '#991b1b' : '#374151' } : undefined}
            >
              {ldStatus && ldStatus.kind === 'scan' && <><i className="bi bi-hourglass-split me-1"></i>{ldStatus.text}</>}
              {ldStatus && ldStatus.kind === 'error' && <><i className="bi bi-x-circle-fill me-1" style={{ color: '#dc2626' }}></i>{ldStatus.text}</>}
            </div>

            <div id="ldResultSection" style={{ display: ldSummary ? 'block' : 'none', marginTop: 16 }}>
              <div className="ld-result-header">
                <div className="ld-result-title">
                  <i className="bi bi-list-ul"></i> New Records
                  <span className="ld-count-badge" id="ldCountBadge">{ldRemaining}</span>
                </div>
                <button className="btn-success-sm" id="ldAddAllBtn" onClick={ldAddAll} disabled={ldRemaining === 0 || ldAddAllBusy}>
                  {ldAddAllBusy ? (
                    <><i className="bi bi-hourglass-split"></i> Adding…</>
                  ) : (
                    <><i className="bi bi-plus-circle"></i> Add All</>
                  )}
                </button>
              </div>
              <div className="ld-record-list" id="ldRecordList">
                {ldSummary && ldAllDone ? (
                  <div className="ld-empty-hint">
                    <i className="bi bi-check-circle-fill" style={{ fontSize: '2rem', color: '#059669', display: 'block', marginBottom: 8 }}></i>
                    <div style={{ fontWeight: 700, color: '#065f46', fontSize: '0.88rem' }}>{ldAllDone.inserted} record(s) added successfully</div>
                    {ldAllDone.errors.length > 0 && (
                      <div style={{ color: '#92400e', fontSize: '0.78rem', marginTop: 6 }}>
                        {ldAllDone.errors.length} skipped: {ldAllDone.errors.join('; ')}
                      </div>
                    )}
                  </div>
                ) : ldSummary && ldSummary.newCount === 0 ? (
                  <div className="ld-empty-hint">
                    <i className="bi bi-check-circle-fill" style={{ fontSize: '2rem', color: '#059669', display: 'block', marginBottom: 8 }}></i>
                    <div style={{ fontWeight: 700, color: '#065f46', fontSize: '0.88rem' }}>All records already exist in the database</div>
                    <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 4 }}>
                      {ldSummary.totalExcel} record(s) in Excel — {ldSummary.existingCount} already in DB — 0 new.
                    </div>
                  </div>
                ) : ldSummary ? (
                  <>
                    <div style={{ background: '#f8f9fc', padding: '8px 14px', fontSize: '0.75rem', color: '#6b7280', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        <b>{ldSummary.newCount}</b> new record(s) from <b>{ldSummary.totalExcel}</b> in Excel
                        {' '}— <b>{ldSummary.existingCount}</b> already in DB
                      </span>
                    </div>
                    {ldRecords.map((rec: any, i: number) => {
                      const st = ldRow[i];
                      if (st === 'gone') return null;
                      if (st === 'added' || st === 'fading') {
                        const nm = rec && rec.job_name;
                        return (
                          <div
                            key={i}
                            className="ld-record-item"
                            id={`ldr-${i}`}
                            style={st === 'fading' ? { background: '#f0fdf4', transition: 'all .3s', opacity: 0, maxHeight: 0, padding: 0, overflow: 'hidden' } : { background: '#f0fdf4' }}
                          >
                            <div style={{ color: '#065f46', fontSize: '0.82rem', padding: '2px 0', flex: 1 }}>
                              <i className="bi bi-check-circle-fill me-1"></i><b>{nm}</b> added.
                            </div>
                          </div>
                        );
                      }
                      if (!rec) return null;
                      return (
                        <div key={i} className="ld-record-item" id={`ldr-${i}`}>
                          <div className="ldr-no">{i + 1}</div>
                          <div className="ldr-info">
                            <div className="ldr-name" title={rec.job_name}>{rec.job_name}</div>
                            <div className="ldr-meta">
                              {rec.domain && <span><i className="bi bi-grid me-1"></i>{rec.domain}</span>}
                              {rec.client && <span><i className="bi bi-building me-1"></i>{rec.client}</span>}
                              {rec.ol_status && <span><i className="bi bi-activity me-1"></i>{rec.ol_status}</span>}
                              {rec.qc_checker && <span><i className="bi bi-person me-1"></i>{rec.qc_checker}</span>}
                            </div>
                          </div>
                          <button className="btn-add-ld" id={`ldrbtn-${i}`} onClick={() => ldAddOne(i)} disabled={st === 'adding'}>
                            {st === 'adding' ? <i className="bi bi-hourglass-split"></i> : <><i className="bi bi-plus-lg"></i> Add</>}
                          </button>
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="ol-modal-footer">
            <button type="button" className="btn-outline-sm" onClick={closeLoadDataModal}>Close</button>
          </div>
        </div>
      </div>

    </>
  );
}

export default function OwnershipLogPage() {
  return (
    <Suspense fallback={null}>
      <OwnershipLogInner />
    </Suspense>
  );
}
