'use client';
import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePageData } from '@/hooks/usePageData';
import { useAction } from '@/context/Flash';
import { apiPost, qs } from '@/lib/api';

const css = `
/* ═══════════════════════════════════════════════
   DATE NAVIGATOR
═══════════════════════════════════════════════ */
.date-nav-bar {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 14px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}
.dnav-btn {
    background: #f3f4f6;
    border: none;
    border-radius: 8px;
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    color: #374151;
    font-size: 0.85rem;
    transition: all 0.15s;
    flex-shrink: 0;
}
.dnav-btn:hover { background: #1a1f3a; color: #fff; }
.dnav-today {
    width: auto; padding: 0 12px;
    font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.5px; text-transform: uppercase;
    background: #eff6ff; color: #2563eb;
    border: 1.5px solid #bfdbfe;
}
.dnav-today:hover { background: #2563eb; color: #fff; border-color: #2563eb; }
.dnav-date-label {
    display: flex; align-items: center; gap: 8px;
    font-family: 'Syne', sans-serif;
    font-weight: 700; font-size: 0.95rem;
    color: #1a1f3a;
    padding: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
    position: relative;
}
.dnav-date-label:hover { background: #f3f4f6; }
.dnav-date-label i { color: #9ca3af; font-size: 0.8rem; }
#_hiddenDate {
    position: absolute; opacity: 0; width: 1px; height: 1px;
    top: 0; left: 0; pointer-events: none;
}
.dnav-separator { width: 1px; height: 24px; background: #e5e7eb; flex-shrink: 0; }

/* ═══════════════════════════════════════════════
   STAT PILLS
═══════════════════════════════════════════════ */
.stat-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 22px;
    font-size: 0.79rem; font-weight: 700;
}
.sp-prog  { background: #dbeafe; color: #1d4ed8; }
.sp-done  { background: #dcfce7; color: #15803d; }
.sp-leave { background: #fee2e2; color: #b91c1c; }
.sp-train { background: #fef9c3; color: #854d0e; }
.sp-total { background: #f3f4f6; color: #6b7280; }

/* ═══════════════════════════════════════════════
   MAIN TABLE
═══════════════════════════════════════════════ */
.plan-wrap { overflow-x: auto; border-radius: 14px; }
.plan-tbl {
    border-collapse: collapse;
    width: 100%; min-width: 860px;
    font-size: 0.815rem;
}
.plan-tbl thead th {
    background: #1a1f3a;
    color: rgba(255,255,255,0.78);
    font-family: 'Syne', sans-serif;
    font-size: 0.67rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.9px;
    padding: 12px 12px;
    white-space: nowrap;
    border-right: 1px solid rgba(255,255,255,0.07);
    position: sticky; z-index: 20;
}
.plan-tbl thead th:last-child { border-right: none; text-align: center; }

.plan-tbl td {
    border: 1px solid #f0f2f5;
    vertical-align: middle;
}
.p12 { padding: 9px 12px; }

/* Date & Member columns */
.td-date {
    background: linear-gradient(180deg, #2d3561 0%, #1a1f3a 100%);
    color: #fff;
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.76rem; letter-spacing: 0.5px;
    text-align: center; vertical-align: middle;
    padding: 10px 8px; white-space: nowrap;
    border-right: 3px solid #111827 !important;
}
.td-member {
    background: #f8faff;
    font-weight: 700; font-size: 0.84rem; color: #1a1f3a;
    text-align: center; vertical-align: middle;
    padding: 10px 10px; white-space: nowrap;
    border-right: 2px solid #e8edf5 !important;
    min-width: 100px;
}
.td-member.active { border-left: 3px solid #3b82f6 !important; }

/* Rows */
.proj-row { transition: background 0.1s; }
.proj-row:hover td { background: #f8fbff !important; }
.empty-row td { background: #fafafa; }

.no-entry {
    color: #d1d5db; font-style: italic; font-size: 0.78rem;
    padding: 10px 12px;
}

/* Leave / Training marker */
.marker-cell {
    text-align: center; font-weight: 800;
    font-size: 0.82rem; letter-spacing: 0.8px; padding: 10px;
}
.m-leave    { background: #fff1f2; color: #be123c; }
.m-training { background: #fffbeb; color: #92400e; }

/* Status badges */
.sbadge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 20px;
    font-size: 0.71rem; font-weight: 700; white-space: nowrap;
}
.sb-prog  { background: #dbeafe; color: #1e40af; }
.sb-done  { background: #d1fae5; color: #065f46; }
.sb-leave { background: #fee2e2; color: #991b1b; }
.sb-train { background: #fef3c7; color: #92400e; }
.sb-pend  { background: #f3e8ff; color: #6b21a8; }

/* Action buttons */
.act-wrap { display: flex; gap: 4px; justify-content: center; padding: 6px; }
.abtn {
    border: none; border-radius: 7px;
    padding: 5px 9px; font-size: 0.74rem;
    cursor: pointer; transition: all 0.15s;
    display: inline-flex; align-items: center; gap: 3px;
}
.abtn-edit   { background: #eff6ff; color: #2563eb; }
.abtn-edit:hover   { background: #2563eb; color: #fff; }
.abtn-del    { background: #fff1f2; color: #e11d48; }
.abtn-del:hover    { background: #e11d48; color: #fff; }
.abtn-add    { background: #f0fdf4; color: #16a34a; border: 1.5px dashed #86efac; }
.abtn-add:hover    { background: #16a34a; color: #fff; border-style: solid; }

/* ── User group separator ── */
.user-sep td {
    height: 7px !important;
    padding: 0 !important;
    background: #edf0f7 !important;
    border-top: 2px solid #d8dde8 !important;
    border-bottom: none !important;
}

/* Inline add trigger row */
.add-trigger td {
    background: #f5f8ff;
    border-top: 1.5px dashed #dbeafe !important;
    padding: 5px 12px;
}
.btn-add-more {
    background: none; border: 1.5px dashed #93c5fd; color: #3b82f6;
    border-radius: 7px; padding: 3px 14px;
    font-size: 0.73rem; font-weight: 700;
    cursor: pointer; transition: all 0.15s;
}
.btn-add-more:hover { background: #3b82f6; color: #fff; border-style: solid; }

/* Inline add form row */
.inline-add { display: none; }
.inline-add td { background: #f0f9ff; border-top: 2px solid #93c5fd !important; }
.inline-hdr {
    background: #1a1f3a !important;
    color: #fff;
    font-family: 'Syne', sans-serif;
    font-size: 0.7rem; font-weight: 700;
    text-align: center; padding: 8px;
    text-transform: uppercase; letter-spacing: 0.6px;
}
.inline-add input, .inline-add select {
    font-size: 0.78rem; padding: 5px 8px;
    border: 1.5px solid #d1d5db; border-radius: 7px;
    width: 100%; box-sizing: border-box; background: #fff;
    font-family: 'DM Sans', sans-serif;
}
.inline-add input:focus, .inline-add select:focus {
    outline: none; border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.14);
}

/* ═══════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════ */
.qmodal-bg {
    display: none; position: fixed; inset: 0; z-index: 2000;
    background: rgba(10,15,40,0.6);
    backdrop-filter: blur(4px);
    align-items: center; justify-content: center;
    padding: 1rem;
}
.qmodal-bg.open { display: flex; animation: bgIn 0.2s ease; }
@keyframes bgIn { from{opacity:0} to{opacity:1} }

.qmodal {
    background: #fff; border-radius: 18px;
    width: 100%; max-width: 580px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.25);
    animation: modalUp 0.25s cubic-bezier(.32,.72,0,1);
    max-height: 92vh; overflow-y: auto;
}
@keyframes modalUp {
    from { transform: translateY(28px) scale(0.98); opacity: 0; }
    to   { transform: translateY(0)    scale(1);    opacity: 1; }
}

.qmodal-header {
    background: linear-gradient(135deg, #1a1f3a 0%, #2d3a6e 100%);
    color: #fff; padding: 18px 22px;
    border-radius: 18px 18px 0 0;
    display: flex; align-items: center; justify-content: space-between;
}
.qmodal-title {
    font-family: 'Syne', sans-serif;
    font-weight: 700; font-size: 1.02rem;
    display: flex; align-items: center; gap: 10px;
}
.qmodal-title .modal-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.95rem;
}
.qmodal-close {
    background: rgba(255,255,255,0.12); border: none; color: #fff;
    border-radius: 8px; width: 32px; height: 32px;
    cursor: pointer; font-size: 0.95rem;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
}
.qmodal-close:hover { background: rgba(255,255,255,0.25); }

.qmodal-body { padding: 22px; }
.qmodal-footer {
    padding: 14px 22px; border-top: 1px solid #f0f2f5;
    display: flex; gap: 8px; justify-content: flex-end;
    background: #fafbfc; border-radius: 0 0 18px 18px;
}

/* Form fields inside modal */
.mfield { margin-bottom: 14px; }
.mfield label {
    display: block; margin-bottom: 5px;
    font-weight: 600; font-size: 0.81rem; color: #374151;
}
.mfield label .req { color: #e84c4c; margin-left: 2px; }
.mctrl {
    width: 100%; padding: 9px 12px;
    border: 1.5px solid #e5e7eb; border-radius: 9px;
    font-size: 0.875rem; font-family: 'DM Sans', sans-serif;
    box-sizing: border-box; transition: border-color 0.15s;
    background: #fff;
}
.mctrl:focus {
    outline: none; border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
}
.mrow { display: grid; gap: 12px; }
.mcol2 { grid-template-columns: 1fr 1fr; }
.mcol3 { grid-template-columns: 1fr 1fr 1fr; }

/* Status select with color */
select.mctrl option[value="IN PROGRESS"] { color: #1e40af; }
select.mctrl option[value="COMPLETED"]   { color: #065f46; }
select.mctrl option[value="LEAVE"]       { color: #991b1b; }
select.mctrl option[value="TRAINING"]    { color: #92400e; }
select.mctrl option[value="PENDING"]     { color: #6b21a8; }

.status-indicator {
    display: inline-block; padding: 4px 12px;
    border-radius: 20px; font-size: 0.75rem; font-weight: 700;
    margin-top: 4px; transition: all 0.2s;
}

/* Field group that hides for Leave/Training */
.project-fields { transition: opacity 0.2s; }
.project-fields.dimmed { opacity: 0.3; pointer-events: none; }

/* Section divider in modal */
.msect {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: #9ca3af;
    margin: 14px 0 8px; border-bottom: 1px solid #f0f2f5; padding-bottom: 5px;
}

/* Submitted date highlight */
.submitted-highlight {
    background: #f0fdf4; border-color: #86efac !important;
}

/* ── Multi-member dropdown ── */
.mselect-wrap { position: relative; }
.mselect-trigger {
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer; user-select: none; gap: 6px;
}
.mselect-dropdown {
    display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: #fff; border: 1.5px solid #c7d2fe; border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.13); z-index: 9999;
    max-height: 210px; overflow-y: auto;
}
.mselect-dropdown.open { display: block; }
.mselect-opt {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 12px; cursor: pointer; font-size: 0.875rem;
    color: #374151; margin: 0; transition: background 0.1s;
}
.mselect-opt:hover { background: #f3f4f6; }
.mselect-opt input[type="checkbox"] { margin: 0; accent-color: #4f46e5; flex-shrink: 0; }
.mselect-tags { display: flex; flex-wrap: wrap; gap: 4px; min-height: 1em; }
.mselect-tag {
    background: #e0e7ff; color: #3730a3; border-radius: 4px;
    padding: 1px 7px; font-size: 0.73rem; font-weight: 600; white-space: nowrap;
}
.mselect-placeholder { color: #9ca3af; }

/* ═══════════════════════════════════════════════
   POLISH (overrides)
═══════════════════════════════════════════════ */
.plan-tbl { font-size: 0.83rem; }
.plan-tbl thead th { padding: 14px 12px; }
.plan-tbl td { border: none; border-bottom: 1px solid #f1f3f8; }
.plan-tbl tbody tr.proj-row:last-of-type td { border-bottom: none; }
.plan-tbl tbody tr.proj-row:hover td { background: #f6f9ff !important; }
.td-member {
    text-align: left; white-space: normal; min-width: 170px;
    padding: 12px 14px; background: #fafbff;
    border-right: 1px solid #eceff6 !important;
}
.td-member.active { border-left: 4px solid #3b82f6 !important; }
.member-cell { display: flex; align-items: center; gap: 10px; }
.member-avatar {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: 'Syne', sans-serif; font-weight: 700; font-size: .85rem;
    box-shadow: 0 2px 6px rgba(17,24,39,.15);
}
.member-name { font-weight: 700; color: #1a1f3a; line-height: 1.15; }
.member-count { font-size: .7rem; font-weight: 600; color: #9ca3af; margin-top: 2px; }
.proj-name { font-weight: 600; color: #1f2937; }
.note-chip {
    display: inline-block; margin-left: 8px; padding: 1px 8px; border-radius: 20px;
    background: #f1f5f9; color: #64748b; font-size: .68rem; font-weight: 600; vertical-align: 1px;
}
.empty-row td { background: #fff; }
.empty-row .td-member { background: #fafbff; opacity: .9; }
.no-entry { color: #b6bdc9; }
.user-sep td { height: 10px !important; background: #f3f5fa !important; border-top: none !important; }
.abtn { width: 30px; height: 30px; padding: 0; justify-content: center; border-radius: 8px; }
.sbadge { padding: 4px 11px; }
.stat-pill { box-shadow: 0 1px 2px rgba(17,24,39,.05); }
`;

/* ── helpers ─────────────────────────────────────────────── */
const AVATAR_COLORS = ['#1a1f3a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#e84c4c', '#06b6d4'];

function MemberCell({ name, uid, count }: { name: string; uid: string; count?: number }) {
  const color = AVATAR_COLORS[(parseInt(uid, 10) || 0) % AVATAR_COLORS.length];
  return (
    <div className="member-cell">
      <div className="member-avatar" style={{ background: color }}>
        {(name || '?')[0].toUpperCase()}
      </div>
      <div>
        <div className="member-name">{name}</div>
        {count ? <div className="member-count">{count} {count === 1 ? 'project' : 'projects'}</div> : null}
      </div>
    </div>
  );
}

const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const jint = (s: string) => {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
};

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map((x) => parseInt(x, 10));
  return [y, m, d];
}
// strftime('%A, %B %d, %Y')
function longDate(iso: string): string {
  const [y, m, d] = ymd(iso);
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]}, ${MONTHS_LONG[m - 1]} ${pad2(d)}, ${y}`;
}
// strftime('%d %b %Y')
function shortDate(iso: string): string {
  const [y, m, d] = ymd(iso);
  return `${pad2(d)} ${MONTHS_SHORT[m]} ${y}`;
}
// dd-Mon-yyyy from the first 10 chars
function fmtDMY(s: string): string {
  const d = s.slice(0, 10).split('-');
  return `${d[2]}-${MONTHS_SHORT[jint(d[1])] ?? ''}-${d[0]}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
// A value the browser would keep for <input type=date> / <input type=datetime-local>
const dateVal = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const dtLocalVal = (v: string) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v) ? v : '');

function SubmittedCell({ e }: { e: any }) {
  if (!e.submitted_date) return <span style={{ color: '#94a3b8' }}>—</span>;
  const sd: string = String(e.submitted_date).replace(/T/g, ' ');
  const dt_part = sd.slice(0, 10);
  const tm_part = sd.length > 10 ? sd.slice(11, 16) : '';
  const color = e.submission_date && dt_part > String(e.submission_date).slice(0, 10) ? '#dc2626' : '#059669';
  let body: string;
  if (tm_part) {
    const hr = jint(tm_part.slice(0, 2));
    const mn = tm_part.slice(3, 5);
    const ampm = hr < 12 ? 'AM' : 'PM';
    let hr12 = hr % 12;
    if (hr12 === 0) hr12 = 12;
    body = `${dt_part} ${pad2(hr12)}:${mn} ${ampm}`;
  } else {
    body = dt_part;
  }
  return <span style={{ color, fontWeight: 600 }}>{body}</span>;
}

function ExpCell({ e }: { e: any }) {
  if (!e.expected_completion) return <span style={{ color: '#94a3b8' }}>—</span>;
  const ec: string = String(e.expected_completion).replace(/T/g, ' ');
  const ec_hr = ec.length > 10 ? jint(ec.slice(11, 13)) : null;
  let tail: React.ReactNode = null;
  if (ec_hr !== null) {
    const ec_mn = ec.slice(14, 16);
    const ampm = ec_hr < 12 ? 'AM' : 'PM';
    let hr12 = ec_hr % 12;
    if (hr12 === 0) hr12 = 12;
    tail = (
      <>
        <br />
        {pad2(hr12)}:{ec_mn} {ampm}
      </>
    );
  }
  return (
    <span style={{ color: '#7c3aed', fontWeight: 600 }}>
      {fmtDMY(ec)}
      {tail}
    </span>
  );
}

function StatusCell({ status }: { status: string }) {
  if (status === 'COMPLETED')
    return (
      <span className="sbadge sb-done">
        <i className="bi bi-check-circle-fill"></i> Completed
      </span>
    );
  if (status === 'IN PROGRESS')
    return (
      <span className="sbadge sb-prog">
        <i className="bi bi-arrow-clockwise"></i> In Progress
      </span>
    );
  if (status === 'PENDING')
    return (
      <span className="sbadge sb-pend">
        <i className="bi bi-hourglass-split"></i> Pending
      </span>
    );
  return (
    <span className="sbadge" style={{ background: '#f3f4f6', color: '#9ca3af' }}>
      {status}
    </span>
  );
}

/* Inline add row (always hidden by CSS in the original; kept for parity) */
function InlineAddRow({ uid, userName, hasEntries, selectedDate, onSubmit }: { uid: string; userName: string; hasEntries: boolean; selectedDate: string; onSubmit: (uid: string, form: HTMLFormElement) => void }) {
  const [shown, setShown] = useState(false); // hideInline() -> display:none
  const formId = `ilf-${uid}`;
  const rowRef = useRef<HTMLTableRowElement>(null);
  void setShown;
  void selectedDate;
  function statusChange(sel: HTMLSelectElement) {
    const row = sel.closest('tr');
    const subm = row?.querySelector('.il-subm') as HTMLInputElement | null;
    if (sel.value === 'COMPLETED' && subm && !subm.value) {
      subm.value = new Date().toISOString().slice(0, 10);
    }
  }
  return (
    <tr className="inline-add" id={`il-${uid}`} ref={rowRef} style={shown ? { display: 'table-row' } : undefined}>
      <td colSpan={2} className="inline-hdr">
        {hasEntries ? '+ ' : ''}
        {userName}
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(uid, e.currentTarget);
          }}
        ></form>
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input type="text" name="project_name" placeholder="Project name" list="pjList" required form={formId} />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input type="date" name="submission_date" form={formId} />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input type="date" name="received_date" className="il-recv" form={formId} />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input type="date" name="submitted_date" className="il-subm" form={formId} />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input type="datetime-local" name="expected_completion" form={formId} />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <select name="status" className="il-status" form={formId} onChange={(e) => statusChange(e.target)}>
          <option value="IN PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="LEAVE">Leave</option>
          <option value="TRAINING">Training</option>
          <option value="PENDING">Pending</option>
        </select>
      </td>
      <td>
        <div className="act-wrap">
          <button
            type="button"
            className="abtn"
            style={{ background: '#f0fdf4', color: '#16a34a' }}
            onClick={() => {
              const f = document.getElementById(formId) as HTMLFormElement | null;
              if (f) onSubmit(uid, f);
            }}
          >
            <i className="bi bi-check-lg"></i>
          </button>
          <button type="button" className="abtn abtn-del" onClick={() => setShown(false)}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </td>
    </tr>
  );
}

type ModalForm = {
  dateFrom: string;
  dateTo: string;
  users: string[];
  status: string;
  project: string;
  subDate: string;
  recDate: string;
  submDate: string;
  expComplete: string;
  notes: string;
};

const emptyForm = (dateFrom: string): ModalForm => ({
  dateFrom,
  dateTo: '',
  users: [],
  status: 'IN PROGRESS',
  project: '',
  subDate: '',
  recDate: '',
  submDate: '',
  expComplete: '',
  notes: '',
});

function DailyWorkPlanInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const dateParam = sp.get('date') || '';
  const openModalParam = sp.get('openModal');
  const { data, reload } = usePageData<any>('/api/pages/daily-work-plan' + qs({ date: dateParam }));
  const run = useAction();

  /* add / edit modal state */
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [origEntryId, setOrigEntryId] = useState('');
  const [editAction, setEditAction] = useState('');
  const [f, setF] = useState<ModalForm>(emptyForm(''));
  const [ddOpen, setDdOpen] = useState(false);
  const mselWrapRef = useRef<HTMLDivElement>(null);
  const mselTriggerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  /* transfer modal state */
  const [trOpen, setTrOpen] = useState(false);
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trDateFrom, setTrDateFrom] = useState('');
  const [trDateTo, setTrDateTo] = useState('');
  const [trMsg, setTrMsg] = useState<{ text: string; color: string }>({ text: '', color: '' });

  const currentISO: string = data?.selected_date || '';

  // Auto-open modal if ?openModal=1 (once, after data is available)
  const autoOpened = useRef(false);
  useEffect(() => {
    if (data && !autoOpened.current && openModalParam === '1') {
      autoOpened.current = true;
      openAddModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // close multi-member dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (mselWrapRef.current && !mselWrapRef.current.contains(e.target as Node)) setDdOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  if (!data) return <style>{css}</style>;

  const { selected_date, today_iso, users, day_data, projects } = data;

  /* ── Date navigator ── */
  function gotoDate(iso: string) {
    router.push('/daily-work-plan?date=' + iso);
  }
  function navDay(delta: number) {
    const d = new Date(currentISO + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    gotoDate(d.toISOString().slice(0, 10));
  }
  function triggerPicker() {
    const inp = hiddenDateRef.current;
    if (!inp) return;
    inp.style.pointerEvents = 'auto';
    try {
      (inp as any).showPicker();
    } catch (e) {
      inp.click();
    }
    setTimeout(() => {
      inp.style.pointerEvents = 'none';
    }, 800);
  }

  /* ── stats ── */
  const ns = { total: 0, done: 0, prog: 0, leave: 0, train: 0 };
  for (const user of users) {
    const ents = (day_data[String(user.id)] || {}).entries || [];
    for (const e of ents) {
      ns.total++;
      if (e.status === 'COMPLETED') ns.done++;
      else if (e.status === 'IN PROGRESS') ns.prog++;
      else if (e.status === 'LEAVE') ns.leave++;
      else if (e.status === 'TRAINING') ns.train++;
    }
  }

  /* ── add/edit modal ── */
  function applyCompleted(x: ModalForm): ModalForm {
    // addStatusChange(): COMPLETED with empty Submitted -> today
    if (x.status === 'COMPLETED' && !x.submDate) return { ...x, submDate: todayISO() };
    return x;
  }

  function openAddModal(preUserId?: string) {
    setMode('add');
    setEditAction('');
    setOrigEntryId('');
    setF(
      applyCompleted({
        ...emptyForm(currentISO),
        users: preUserId ? users.filter((u: any) => String(u.id) === String(preUserId)).map((u: any) => String(u.id)) : [],
        recDate: todayISO(),
      })
    );
    setDdOpen(false);
    setAddOpen(true);
    setTimeout(() => mselTriggerRef.current?.focus(), 100);
  }

  function openEditModal(e: any, uid: string) {
    const status: string = e.status;
    const submDate: string = e.submitted_date || '';
    const expComplete: string = e.expected_completion || '';
    let submVal = '';
    if (submDate) {
      const n = submDate.replace(' ', 'T');
      submVal = n.length >= 16 ? n.slice(0, 16) : n + 'T00:00';
    }
    let expVal = '';
    if (expComplete) {
      const n = expComplete.replace(' ', 'T');
      expVal = n.length >= 16 ? n.slice(0, 16) : n + 'T00:00';
    }
    setMode('edit');
    setEditAction('edit');
    setOrigEntryId(e.id);
    setF(
      applyCompleted({
        dateFrom: currentISO,
        dateTo: '',
        users: users.filter((u: any) => String(u.id) === String(uid)).map((u: any) => String(u.id)),
        status,
        project: status === 'LEAVE' || status === 'TRAINING' ? '' : e.project_name,
        // assigning to <input type=date>/<datetime-local> drops values the browser considers invalid
        subDate: dateVal(e.submission_date || ''),
        recDate: dateVal(e.received_date || ''),
        submDate: dateVal(submVal),
        expComplete: dtLocalVal(expVal),
        notes: e.notes || '',
      })
    );
    setDdOpen(false);
    setAddOpen(true);
    setTimeout(() => statusRef.current?.focus(), 100);
  }

  function setField<K extends keyof ModalForm>(k: K, v: ModalForm[K]) {
    setF((x) => ({ ...x, [k]: v }));
  }
  function onStatusChange(v: string) {
    setF((x) => applyCompleted({ ...x, status: v }));
  }
  function toggleUser(id: string, checked: boolean) {
    setF((x) => ({ ...x, users: checked ? [...x.users.filter((u) => u !== id), id] : x.users.filter((u) => u !== id) }));
  }

  async function onAddSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (f.users.length === 0) {
      alert('Please select at least one team member.');
      return;
    }
    const fd = new FormData();
    fd.append('plan_date', selected_date);
    fd.append('_edit_action', editAction);
    fd.append('_orig_entry_id', origEntryId);
    fd.append('plan_date_from', f.dateFrom);
    fd.append('plan_date_to', f.dateTo);
    // DOM order of the checkboxes
    users.forEach((u: any) => {
      if (f.users.includes(String(u.id))) fd.append('user_id', String(u.id));
    });
    fd.append('status', f.status);
    fd.append('project_name', f.project);
    fd.append('submission_date', f.subDate);
    fd.append('received_date', f.recDate);
    fd.append('submitted_date', f.submDate);
    fd.append('expected_completion', f.expComplete);
    fd.append('notes', f.notes);
    await run('POST', '/api/actions/daily-work-plan/add-entry', fd);
    setAddOpen(false);
  }

  async function onDelete(uid: string, entryId: string) {
    if (!confirm('Delete this entry?')) return;
    await run('POST', `/api/actions/daily-work-plan/delete/${selected_date}/${uid}/${entryId}`);
  }

  async function onInlineSubmit(uid: string, form: HTMLFormElement) {
    await run('POST', `/api/actions/daily-work-plan/add-project/${selected_date}/${uid}`, new FormData(form));
  }

  /* ── Transfer modal ── */
  function openTransferModal() {
    setTrFrom('');
    setTrTo('');
    setTrDateFrom(currentISO);
    setTrDateTo('');
    setTrMsg({ text: '', color: '' });
    setTrOpen(true);
  }

  async function doTransfer() {
    if (!trFrom || !trTo || !trDateFrom) {
      setTrMsg({ color: '#991b1b', text: 'Please fill in From User, To User and Date From.' });
      return;
    }
    const j = await apiPost('/api/daily-plan/transfer', {
      from_user_id: parseInt(trFrom),
      to_user_id: parseInt(trTo),
      date_from: trDateFrom,
      date_to: trDateTo || trDateFrom,
    });
    if (j.ok) {
      setTrMsg({ color: '#166534', text: j.message });
      setTimeout(() => {
        setTrOpen(false);
        reload();
      }, 1200);
    } else {
      setTrMsg({ color: '#991b1b', text: j.error || 'Transfer failed.' });
    }
  }

  const isMarker = ['LEAVE', 'TRAINING'].includes(f.status);
  const checkedUsers = users.filter((u: any) => f.users.includes(String(u.id)));

  return (
    <>
      <style>{css}</style>

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-calendar-check-fill me-2" style={{ color: '#3b82f6', fontSize: '1.3rem' }}></i>
            Daily Work Plan
          </h1>
          <p className="page-subtitle">{longDate(selected_date)}</p>
        </div>

        <div className="d-flex gap-2 align-items-center flex-wrap">
          {/* Date Navigator */}
          <div className="date-nav-bar">
            <button className="dnav-btn" onClick={() => navDay(-1)} title="Previous day">
              <i className="bi bi-chevron-left"></i>
            </button>

            <div className="dnav-date-label" onClick={triggerPicker}>
              <span id="dnav-display">{shortDate(selected_date)}</span>
              <i className="bi bi-calendar3"></i>
              <input
                type="date"
                id="_hiddenDate"
                ref={hiddenDateRef}
                value={selected_date}
                onChange={(e) => gotoDate(e.target.value)}
              />
            </div>

            <button className="dnav-btn" onClick={() => navDay(1)} title="Next day">
              <i className="bi bi-chevron-right"></i>
            </button>

            <div className="dnav-separator"></div>

            <button className="dnav-btn dnav-today" onClick={() => gotoDate(today_iso)} title="Jump to today">
              Today
            </button>
          </div>

          {/* Export */}
          <a
            href={`/api/actions/daily-work-plan/export/${selected_date}`}
            className="btn btn-sm d-flex align-items-center gap-2"
            style={{ background: '#059669', color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', padding: '8px 16px', boxShadow: '0 2px 6px rgba(5,150,105,.25)' }}
          >
            <i className="bi bi-file-earmark-excel-fill"></i> Export
          </a>

          {/* Transfer */}
          <button
            onClick={openTransferModal}
            className="btn btn-sm d-flex align-items-center gap-2"
            style={{ background: '#6366f1', color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', padding: '8px 16px', boxShadow: '0 2px 6px rgba(99,102,241,.3)' }}
          >
            <i className="bi bi-arrow-left-right"></i> Transfer
          </button>

          {/* Add Entry */}
          <button
            onClick={() => openAddModal()}
            className="btn btn-sm d-flex align-items-center gap-2"
            style={{ background: '#e84c4c', color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', padding: '8px 16px', boxShadow: '0 2px 6px rgba(232,76,76,.3)' }}
          >
            <i className="bi bi-plus-lg"></i> Add Entry
          </button>
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="d-flex gap-2 flex-wrap mb-3">
        <span className="stat-pill sp-prog" title="In Progress">
          <i className="bi bi-arrow-clockwise"></i>
          {ns.prog} In Progress
        </span>
        <span className="stat-pill sp-done" title="Completed">
          <i className="bi bi-check-circle-fill"></i>
          {ns.done} Completed
        </span>
        <span className="stat-pill sp-leave" title="On Leave">
          <i className="bi bi-calendar-x-fill"></i>
          {ns.leave} Leave
        </span>
        <span className="stat-pill sp-train" title="Training">
          <i className="bi bi-mortarboard-fill"></i>
          {ns.train} Training
        </span>
        <span className="stat-pill sp-total">
          <i className="bi bi-layers-fill"></i>
          {ns.total} Total
        </span>
      </div>

      {/* MAIN TABLE */}
      <div className="card p-0" style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
        <div className="plan-wrap">
          <table className="plan-tbl">
            <thead>
              <tr>
                <th style={{ width: 190 }}>Member</th>
                <th style={{ minWidth: 200 }}>Project / Task</th>
                <th style={{ width: 110, textAlign: 'center' }}>Submission</th>
                <th style={{ width: 110, textAlign: 'center' }}>Received</th>
                <th style={{ width: 120, textAlign: 'center' }}>Submitted</th>
                <th style={{ width: 120, textAlign: 'center' }}>Exp Completion</th>
                <th style={{ width: 118, textAlign: 'center' }}>Status</th>
                <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => {
                const uid = String(user.id);
                const udata = day_data[uid] || {};
                const entries: any[] = udata.entries || [];

                if (!entries.length) {
                  return (
                    <Fragment key={uid}>
                      <tr className="empty-row">
                        <td className="td-member">
                          <MemberCell name={user.full_name} uid={uid} />
                        </td>
                        <td colSpan={6}>
                          <span className="no-entry">No entries yet</span>
                        </td>
                        <td>
                          <div className="act-wrap">
                            <button className="abtn abtn-add" onClick={() => openAddModal(uid)} title="Add project">
                              <i className="bi bi-plus-lg"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                      <InlineAddRow uid={uid} userName={user.full_name} hasEntries={false} selectedDate={selected_date} onSubmit={onInlineSubmit} />
                      <tr className="user-sep">
                        <td colSpan={9}></td>
                      </tr>
                    </Fragment>
                  );
                }

                const rowspan = entries.length + 1;
                return (
                  <Fragment key={uid}>
                    {entries.map((e, idx) => (
                      <tr className="proj-row" key={e.id}>
                        {idx === 0 && (
                          <td className="td-member active" rowSpan={rowspan}>
                            <MemberCell name={user.full_name} uid={uid} count={entries.length} />
                          </td>
                        )}

                        {e.status === 'LEAVE' || e.status === 'TRAINING' ? (
                          <>
                            <td colSpan={5} className={'marker-cell ' + (e.status === 'LEAVE' ? 'm-leave' : 'm-training')}>
                              <i className={'bi bi-' + (e.status === 'LEAVE' ? 'calendar-x-fill' : 'mortarboard-fill') + ' me-2'}></i>
                              {e.status}
                            </td>
                            <td className="p12">
                              <span className={'sbadge ' + (e.status === 'LEAVE' ? 'sb-leave' : 'sb-train')}>{e.status}</span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p12">
                              <span className="proj-name">{e.project_name}</span>
                              {e.notes ? <span className="note-chip">{e.notes}</span> : null}
                            </td>
                            <td className="p12" style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.77rem' }}>
                              {e.submission_date ? fmtDMY(String(e.submission_date)) : '—'}
                            </td>
                            <td className="p12" style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.77rem' }}>
                              {e.received_date ? fmtDMY(String(e.received_date)) : '—'}
                            </td>
                            <td className="p12" style={{ textAlign: 'center', fontSize: '0.77rem' }}>
                              <SubmittedCell e={e} />
                            </td>
                            <td className="p12" style={{ textAlign: 'center', fontSize: '0.77rem' }}>
                              <ExpCell e={e} />
                            </td>
                            <td className="p12">
                              <StatusCell status={e.status} />
                            </td>
                          </>
                        )}

                        <td>
                          <div className="act-wrap">
                            <button className="abtn abtn-edit" title="Edit" onClick={() => openEditModal(e, uid)}>
                              <i className="bi bi-pencil-fill"></i>
                            </button>
                            <form
                              style={{ margin: 0 }}
                              onSubmit={(ev) => {
                                ev.preventDefault();
                                onDelete(uid, e.id);
                              }}
                            >
                              <button type="submit" className="abtn abtn-del" title="Delete">
                                <i className="bi bi-trash-fill"></i>
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}

                    <InlineAddRow uid={uid} userName={user.full_name} hasEntries={true} selectedDate={selected_date} onSubmit={onInlineSubmit} />
                    <tr className="add-trigger">
                      <td colSpan={9}>
                        <button className="btn-add-more" onClick={() => openAddModal(uid)}>
                          <i className="bi bi-plus me-1"></i>Add another project for {user.full_name}
                        </button>
                      </td>
                    </tr>
                    <tr className="user-sep">
                      <td colSpan={9}></td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Autocomplete datalists */}
      <datalist id="pjList">
        {(projects || []).map((p: string, i: number) => (
          <option key={i} value={p} />
        ))}
      </datalist>

      {/* Legend */}
      <div className="d-flex gap-3 flex-wrap mt-3" style={{ fontSize: '0.77rem', color: '#9ca3af' }}>
        <span className="ms-auto">
          <span className="sbadge sb-done me-1">Completed</span>
          <span className="sbadge sb-prog me-1">In Progress</span>
          <span className="sbadge sb-leave me-1">Leave</span>
          <span className="sbadge sb-train me-1">Training</span>
          <span className="sbadge sb-pend">Pending</span>
        </span>
      </div>

      {/* ADD ENTRY MODAL */}
      <div className={'qmodal-bg' + (addOpen ? ' open' : '')} id="addModal">
        <div className="qmodal">
          <div className="qmodal-header">
            <div className="qmodal-title">
              <span className="modal-icon" id="modalIcon">
                <i className={'bi bi-' + (mode === 'edit' ? 'pencil-fill' : 'plus-lg')}></i>
              </span>
              <span id="modalTitleText">{mode === 'edit' ? 'Edit Entry' : 'Add Entry'}</span>
            </div>
            <button className="qmodal-close" onClick={() => setAddOpen(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <form id="addForm" onSubmit={onAddSubmit}>
            <input type="hidden" name="plan_date" value={selected_date} readOnly />
            <input type="hidden" name="_edit_action" id="editAction" value={editAction} readOnly />
            <input type="hidden" name="_orig_entry_id" id="origEntryId" value={origEntryId} readOnly />
            <div className="qmodal-body">
              {/* Plan date range */}
              <div id="addDateRange">
                <div className="msect" style={{ marginTop: 0 }}>Plan Date</div>
                <div className="mrow mcol2" style={{ marginBottom: 14 }}>
                  <div className="mfield" style={{ marginBottom: 0 }}>
                    <label>
                      From<span className="req">*</span>
                    </label>
                    <input type="date" name="plan_date_from" className="mctrl" id="addDateFrom" value={f.dateFrom} onChange={(e) => setField('dateFrom', e.target.value)} />
                  </div>
                  <div className="mfield" style={{ marginBottom: 0 }}>
                    <label>
                      To <small style={{ color: '#9ca3af' }}>(blank = single day)</small>
                    </label>
                    <input type="date" name="plan_date_to" className="mctrl" id="addDateTo" value={f.dateTo} onChange={(e) => setField('dateTo', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="mrow mcol2">
                {/* multi-member dropdown */}
                <div className="mfield" id="multiMemberField">
                  <label>
                    Team Member<span className="req">*</span>
                  </label>
                  <div className="mselect-wrap" id="userMselWrap" ref={mselWrapRef}>
                    <div
                      className="mctrl mselect-trigger"
                      id="userMselTrigger"
                      ref={mselTriggerRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDdOpen((o) => !o);
                      }}
                    >
                      <div className="mselect-tags" id="userMselTags">
                        {checkedUsers.length === 0 ? (
                          <span className="mselect-placeholder">— Select Members —</span>
                        ) : (
                          checkedUsers.map((u: any) => (
                            <span className="mselect-tag" key={u.id}>
                              {String(u.full_name).trim()}
                            </span>
                          ))
                        )}
                      </div>
                      <i className="bi bi-chevron-down" style={{ fontSize: '0.7rem', color: '#6b7280', flexShrink: 0 }}></i>
                    </div>
                    <div className={'mselect-dropdown' + (ddOpen ? ' open' : '')} id="userMselDropdown">
                      {users.map((u: any) => (
                        <label className="mselect-opt" key={u.id}>
                          <input
                            type="checkbox"
                            name="user_id"
                            value={u.id}
                            className="user-chk"
                            checked={f.users.includes(String(u.id))}
                            onChange={(e) => toggleUser(String(u.id), e.target.checked)}
                          />
                          <span>{u.full_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mfield">
                  <label>Status</label>
                  <select name="status" className="mctrl" id="addStatus" ref={statusRef} value={f.status} onChange={(e) => onStatusChange(e.target.value)}>
                    <option value="IN PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="LEAVE">Leave</option>
                    <option value="TRAINING">Training</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>

              <div className={'project-fields' + (isMarker ? ' dimmed' : '')} id="addProjFields">
                <div className="msect">Project Details</div>

                <div className="mfield">
                  <label>Project / Task</label>
                  <input
                    type="text"
                    name="project_name"
                    className="mctrl"
                    placeholder="e.g. JV Fletcher CO9 Fab"
                    list="pjList"
                    value={f.project}
                    onChange={(e) => setField('project', e.target.value)}
                  />
                </div>

                <div className="msect">Dates</div>
                <div className="mrow mcol3">
                  <div className="mfield">
                    <label>Submission</label>
                    <input type="date" name="submission_date" className="mctrl" value={f.subDate} onChange={(e) => setField('subDate', e.target.value)} />
                  </div>
                  <div className="mfield">
                    <label>Received</label>
                    <input type="date" name="received_date" className="mctrl" id="addReceived" value={f.recDate} onChange={(e) => setField('recDate', e.target.value)} />
                  </div>
                  <div className="mfield">
                    <label>Submitted</label>
                    <input type="date" name="submitted_date" className="mctrl" id="addSubmitted" value={f.submDate} onChange={(e) => setField('submDate', e.target.value)} />
                  </div>
                </div>

                <div className="mfield">
                  <label>Expected Completion</label>
                  <input type="datetime-local" name="expected_completion" className="mctrl" id="addExpComplete" value={f.expComplete} onChange={(e) => setField('expComplete', e.target.value)} />
                </div>

                <div className="mfield">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    className="mctrl"
                    rows={2}
                    placeholder="Optional notes..."
                    style={{ resize: 'vertical' }}
                    value={f.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                  ></textarea>
                </div>
              </div>
            </div>
            <div className="qmodal-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-primary px-4" id="modalSubmitBtn">
                <i className="bi bi-check-lg me-1"></i>
                <span id="modalSubmitTxt">{mode === 'edit' ? 'Update Entry' : 'Save Entry'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* TRANSFER MODAL */}
      <div className={'qmodal-bg' + (trOpen ? ' open' : '')} id="transferModal">
        <div className="qmodal" style={{ maxWidth: 480 }}>
          <div className="qmodal-header">
            <div className="qmodal-title">
              <span className="modal-icon">
                <i className="bi bi-arrow-left-right"></i>
              </span>
              Transfer Daily Plan Entries
            </div>
            <button className="qmodal-close" onClick={() => setTrOpen(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <div className="qmodal-body">
            <div className="mfield">
              <label>
                From User<span className="req">*</span>
              </label>
              <select id="tr-from" className="mctrl" value={trFrom} onChange={(e) => setTrFrom(e.target.value)}>
                <option value="">— Select source user —</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mfield">
              <label>
                To User<span className="req">*</span>
              </label>
              <select id="tr-to" className="mctrl" value={trTo} onChange={(e) => setTrTo(e.target.value)}>
                <option value="">— Select destination user —</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mrow mcol2">
              <div className="mfield">
                <label>
                  Date From<span className="req">*</span>
                </label>
                <input type="date" id="tr-date-from" className="mctrl" value={trDateFrom} onChange={(e) => setTrDateFrom(e.target.value)} />
              </div>
              <div className="mfield">
                <label>
                  Date To <small style={{ color: '#9ca3af' }}>(leave blank for single day)</small>
                </label>
                <input type="date" id="tr-date-to" className="mctrl" value={trDateTo} onChange={(e) => setTrDateTo(e.target.value)} />
              </div>
            </div>
            <div id="tr-msg" style={{ fontSize: '.83rem', fontWeight: 600, marginTop: 4, color: trMsg.color }}>
              {trMsg.text}
            </div>
          </div>
          <div className="qmodal-footer">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setTrOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary px-4" onClick={doTransfer}>
              <i className="bi bi-arrow-left-right me-1"></i>Transfer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DailyWorkPlanPage() {
  return (
    <Suspense fallback={null}>
      <DailyWorkPlanInner />
    </Suspense>
  );
}
