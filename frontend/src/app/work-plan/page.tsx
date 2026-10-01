'use client';
import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import { useToastApi } from '@/context/Toast';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePageData } from '@/hooks/usePageData';
import { useSession } from '@/context/Session';
import { useAction } from '@/context/Flash';
import { apiPost } from '@/lib/api';

const css = `
/* ═══════════════════════════════════════════
   MONTH NAVIGATOR
═══════════════════════════════════════════ */
.view-toggle {
    display: flex; background: #f0f2f5; border-radius: 9px;
    padding: 3px; gap: 2px;
}
.vt-btn {
    padding: 6px 14px; border-radius: 7px; font-size: 0.8rem;
    font-weight: 600; text-decoration: none; color: #6b7280;
    transition: all .15s; white-space: nowrap;
}
.vt-btn.active { background: #1a1f3a; color: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
.vt-btn:hover:not(.active) { background: #e5e7eb; color: #374151; }

.month-nav-bar {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 14px;
    padding: 6px 10px;
    display: flex; align-items: center; gap: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.mnav-btn {
    background: #f3f4f6; border: none; border-radius: 8px;
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #374151; font-size: 0.85rem;
    transition: all 0.15s; text-decoration: none; flex-shrink: 0;
}
.mnav-btn:hover { background: #1a1f3a; color: #fff; }
.mnav-label {
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.95rem; color: #1a1f3a;
    min-width: 150px; text-align: center; white-space: nowrap;
}
.mnav-sep { width: 1px; height: 24px; background: #e5e7eb; flex-shrink: 0; }
.mnav-today {
    height: 34px; padding: 0 12px;
    font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.5px; text-transform: uppercase;
    background: #eff6ff; color: #2563eb;
    border: 1.5px solid #bfdbfe; border-radius: 8px;
    white-space: nowrap; text-decoration: none;
    display: flex; align-items: center; transition: all 0.15s;
}
.mnav-today:hover { background: #2563eb; color: #fff; border-color: #2563eb; }

/* ═══════════════════════════════════════════
   GRID TABLE
═══════════════════════════════════════════ */
.wp-table {
    font-size: 0.78rem; border-collapse: separate;
    border-spacing: 0; width: 100%;
}
.wp-table th {
    background: #1a1f3a; color: rgba(255,255,255,0.8);
    font-family: 'Syne', sans-serif; font-size: 0.67rem;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    padding: 10px; white-space: nowrap;
    position: sticky; z-index: 20;
    border-right: 1px solid rgba(255,255,255,0.07);
}
.wp-table th.team-header {
    background: #111827; left: 0; z-index: 30;
    min-width: 160px;
    border-right: 3px solid rgba(255,255,255,0.12) !important;
}
.th-day { font-size: 0.85rem; font-weight: 800; display: block; line-height: 1; }
.th-dow { font-size: 0.62rem; opacity: 0.6; letter-spacing: 1px; display: block; margin-top: 2px; }

.team-cell {
    background: inherit;
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.8rem; color: #1a1f3a;
    padding: 10px 12px; white-space: nowrap;
    border-right: 3px solid #e5e7eb; border-bottom: 1px solid #f0f0f0;
    position: sticky; left: 0; z-index: 5;
    box-shadow: 3px 0 6px rgba(0,0,0,0.05);
}

.date-cell {
    border: 1px solid #f0f2f5; padding: 5px 6px;
    vertical-align: top; min-width: 150px; background: inherit;
}
.date-cell:hover { filter: brightness(0.97); }
.weekend-cell { filter: brightness(0.96) saturate(1.2); }
.weekend-cell:hover { filter: brightness(0.94) saturate(1.3); }

/* Each team row color — applies to both sticky team-cell and date-cells */
/* Alternating 2 row colors driven by per-user CSS variables */
.team-row-0 td, .team-row-2 td, .team-row-4 td, .team-row-6 td { background: var(--wp-even); }
.team-row-1 td, .team-row-3 td, .team-row-5 td, .team-row-7 td { background: var(--wp-odd); }
/* Weekend cells inherit the row color; brightness filter provides visual distinction */

/* ── Tags: confirmed=black, post_ofa=red, schedule_imported=teal, qc_not_required=amber ── */
.wp-tag {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 4px 8px; border-radius: 5px;
    font-size: 0.72rem; font-weight: 600;
    margin: 2px 0; line-height: 1.4; gap: 4px;
}
.wp-tag-confirmed          { background: #1a1f3a; color: #fff; }
.wp-tag-post_ofa           { background: #dc2626; color: #fff; border-left: 3px solid #991b1b; }
.wp-tag-schedule_imported  { background: #0d9488; color: #fff; border-left: 3px solid #0a7a70; }
.wp-tag-schedule_imported .wp-act-btn:hover { background: rgba(255,255,255,0.2); }
.wp-tag-qc_not_required    { background: #fef3c7; color: #92400e; border-left: 3px solid #f59e0b; }
.wp-tag-qc_not_required .wp-act-btn:hover { background: rgba(0,0,0,0.08); }


.wp-tag-name { flex: 1; word-break: break-word; line-height: 1.5; }
.wp-tag-notes { opacity: 0.78; font-weight: 500; }

.wp-tag-actions {
    display: none; align-items: center; gap: 1px; flex-shrink: 0;
}
.wp-tag:hover .wp-tag-actions { display: flex; }
.wp-act-btn {
    background: none; border: none; cursor: pointer;
    font-size: 0.65rem; padding: 1px 3px; line-height: 1;
    border-radius: 3px; color: inherit; opacity: 0.7;
    transition: all 0.15s;
}
.wp-act-btn:hover { opacity: 1; background: rgba(255,255,255,0.2); }
.wp-tag-unconfirmed .wp-act-btn:hover { background: rgba(0,0,0,0.08); }

/* Hover add button per cell */
.cell-add-btn {
    display: none; width: 100%; border: none;
    background: rgba(59,130,246,0.08); color: #3b82f6;
    border-radius: 4px; padding: 3px; font-size: 0.75rem;
    cursor: pointer; margin-top: 3px; transition: background 0.15s;
}
.date-cell:hover .cell-add-btn { display: block; }
.cell-add-btn:hover { background: rgba(59,130,246,0.2); }

.team-cell-wrap {
    display: flex; align-items: center; justify-content: space-between; gap: 6px;
}
.team-cell-name { flex: 1; }
.team-cell-actions {
    display: none; gap: 3px; flex-shrink: 0;
}
.team-cell:hover .team-cell-actions { display: flex; }
.tc-btn {
    background: none; border: none; cursor: pointer;
    border-radius: 5px; padding: 3px 5px; font-size: 0.7rem;
    transition: all 0.15s; color: #9ca3af;
}
.tc-btn:hover { background: #f3f4f6; color: #1a1f3a; }
.tc-btn.del:hover { background: #fff1f2; color: #e11d48; }

/* Inline team rename form */
.team-rename-row { display: none; }
.team-rename-row.show { display: table-row; }
.team-rename-row td {
    background: #eff6ff; border-top: 2px solid #93c5fd;
    padding: 8px 10px;
}

/* Legend */
.legend-chip {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 0.79rem; color: #374151;
}
.legend-swatch { width: 26px; height: 14px; border-radius: 3px; flex-shrink: 0; }

/* ── Schedule Track Import ── */
.st-btn {
    height: 36px; padding: 0 16px;
    background: #0d9488;
    color: #fff; border: none; border-radius: 10px;
    font-size: 0.8rem; font-weight: 700; letter-spacing: 0.3px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
    box-shadow: 0 2px 8px rgba(15,118,110,0.35);
    transition: all 0.18s; white-space: nowrap;
}
.st-btn:hover:not(:disabled) {
    background: #0a8a7e;
    box-shadow: 0 4px 14px rgba(15,118,110,0.4);
    transform: translateY(-1px);
}
.st-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
.st-btn .st-spin { animation: stSpin 0.8s linear infinite; }
@keyframes stSpin { to { transform: rotate(360deg); } }

/* ═══════════════════════════════════════════
   MODAL
═══════════════════════════════════════════ */
.qmodal-bg {
    display: none; position: fixed; inset: 0; z-index: 2000;
    background: rgba(10,15,40,0.6); backdrop-filter: blur(4px);
    align-items: center; justify-content: center; padding: 1rem;
}
.qmodal-bg.open { display: flex; animation: bgFade 0.2s ease; }
@keyframes bgFade { from{opacity:0} to{opacity:1} }

.qmodal {
    background: #fff; border-radius: 18px;
    width: 100%; max-width: 500px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.25);
    animation: mUp 0.25s cubic-bezier(.32,.72,0,1); overflow: hidden;
}
@keyframes mUp {
    from { transform: translateY(24px) scale(0.98); opacity:0; }
    to   { transform: translateY(0) scale(1); opacity:1; }
}
.qm-header {
    background: linear-gradient(135deg,#1a1f3a,#2d3a6e);
    color: #fff; padding: 18px 22px;
    display: flex; align-items: center; justify-content: space-between;
}
.qm-title {
    font-family: 'Syne',sans-serif; font-weight: 700; font-size: 1rem;
    display: flex; align-items: center; gap: 10px;
}
.qm-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
}
.qm-close {
    background: rgba(255,255,255,0.12); border: none; color: #fff;
    border-radius: 8px; width: 32px; height: 32px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.95rem; transition: background 0.15s;
}
.qm-close:hover { background: rgba(255,255,255,0.25); }
.qm-body { padding: 22px; }
.qm-footer {
    padding: 14px 22px; border-top: 1px solid #f0f2f5;
    display: flex; gap: 8px; justify-content: flex-end; background: #fafbfc;
}

.mf { margin-bottom: 14px; }
.mf label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 0.81rem; color: #374151; }
.req { color: #e84c4c; margin-left: 2px; }
.mctrl {
    width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb;
    border-radius: 9px; font-size: 0.875rem; font-family: 'DM Sans',sans-serif;
    box-sizing: border-box; background: #fff; transition: border-color 0.15s;
}
.mctrl:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
.mgrid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* Confirmed toggle */
.conf-toggle { display: flex; gap: 8px; }
.conf-opt { display: none; }
.conf-lbl {
    flex: 1; text-align: center; padding: 10px;
    border-radius: 9px; border: 2px solid #e5e7eb;
    font-size: 0.84rem; font-weight: 600; cursor: pointer;
    transition: all 0.18s; user-select: none;
    opacity: 0.45; background: #f3f4f6; color: #6b7280;
}
.conf-lbl:hover { opacity: 0.75; }

/* ADD modal checked states */
#confYes:checked  + .conf-lbl { opacity:1; background:#1a1f3a; color:#fff; border-color:#1a1f3a; box-shadow:0 3px 10px rgba(26,31,58,0.35); }
#confNo:checked   + .conf-lbl { opacity:1; background:#fce8e8; color:#be123c; border-color:#e84c4c; box-shadow:0 3px 10px rgba(232,76,76,0.2); }
#confPost:checked + .conf-lbl { opacity:1; background:#dc2626; color:#fff; border-color:#991b1b; box-shadow:0 3px 10px rgba(220,38,38,0.35); }

/* EDIT modal checked states */
#eConfYes:checked  + .conf-lbl { opacity:1; background:#1a1f3a; color:#fff; border-color:#1a1f3a; box-shadow:0 3px 10px rgba(26,31,58,0.35); }
#eConfNo:checked   + .conf-lbl { opacity:1; background:#fce8e8; color:#be123c; border-color:#e84c4c; box-shadow:0 3px 10px rgba(232,76,76,0.2); }
#eConfPost:checked + .conf-lbl { opacity:1; background:#dc2626; color:#fff; border-color:#991b1b; box-shadow:0 3px 10px rgba(220,38,38,0.35); }
#confST:checked    + .conf-lbl { opacity:1; background:#0d9488; color:#fff; border-color:#0a7a70; box-shadow:0 3px 10px rgba(15,118,110,0.35); }
#eConfST:checked   + .conf-lbl { opacity:1; background:#0d9488; color:#fff; border-color:#0a7a70; box-shadow:0 3px 10px rgba(15,118,110,0.35); }
#confQCNR:checked  + .conf-lbl { opacity:1; background:#fef3c7; color:#92400e; border-color:#f59e0b; box-shadow:0 3px 10px rgba(245,158,11,0.3); }
#eConfQCNR:checked + .conf-lbl { opacity:1; background:#fef3c7; color:#92400e; border-color:#f59e0b; box-shadow:0 3px 10px rgba(245,158,11,0.3); }
`;

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}
const pad2 = (n: number) => String(n).padStart(2, '0');
// strftime('%d %b') / ('%d %b %Y') / ('%a')
const fmtDM = (iso: string) => { const p = parseISO(iso); return `${pad2(p.d)} ${MON_ABBR[p.m - 1]}`; };
const fmtDMY = (iso: string) => { const p = parseISO(iso); return `${pad2(p.d)} ${MON_ABBR[p.m - 1]} ${p.y}`; };
const weekday = (iso: string) => (parseISO(iso).dow + 6) % 7; // Monday = 0

type Form = { team_name: string; project_name: string; plan_date: string; notes: string; date_confirmed: string };
const emptyForm: Form = { team_name: '', project_name: '', plan_date: '', notes: '', date_confirmed: 'confirmed' };

const CONF_OPTS: [string, string, string, string][] = [
  // value, id suffix, icon, label
  ['confirmed', 'Yes', 'bi-check-circle-fill', 'Confirmed'],
  ['post_ofa', 'Post', 'bi-send-fill', 'POST OFA/FAB'],
  ['schedule_imported', 'ST', 'bi-cloud-download-fill', 'Schedule Import'],
  ['qc_not_required', 'QCNR', 'bi-slash-circle', 'QC Not Required'],
];


export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkPlanPage />
    </Suspense>
  );
}

function WorkPlanPage() {
  const searchParams = useSearchParams();
  const qstr = searchParams.toString();
  const { data, loading, reload } = usePageData<any>('/api/pages/work-plan' + (qstr ? '?' + qstr : ''));
  const { user } = useSession();
  const run = useAction();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<Form>(emptyForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Form>(emptyForm);
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState('');
  const [stBusy, setStBusy] = useState(false);
  const toastApi = useToastApi();

  const addTeamRef = useRef<HTMLInputElement>(null);
  const addProjectRef = useRef<HTMLInputElement>(null);
  const editProjectRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ESC closes everything
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAddOpen(false);
        setEditOpen(false);
        setRenameIdx(null);
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);


  // Sticky header ghost
  const teamNamesLen = data?.team_names?.length || 0;
  useEffect(() => {
    const table = document.querySelector('.wp-table') as HTMLElement | null;
    const scrollWrap = document.getElementById('wp-scroll-wrap');
    if (!table || !scrollWrap) return;
    const thead = table.querySelector('thead') as HTMLElement;
    const STICK_TOP = 60; // topbar height

    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:60px;z-index:500;overflow:hidden;visibility:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.18);';
    const ghostTable = document.createElement('table');
    ghostTable.className = 'wp-table';
    ghostTable.style.cssText = 'border-collapse:separate;border-spacing:0;table-layout:fixed;';
    ghostTable.appendChild(thead.cloneNode(true));
    ghost.appendChild(ghostTable);
    document.body.appendChild(ghost);

    function syncGhost() {
      const origThs = thead.querySelectorAll('th');
      const ghostThs = ghost.querySelectorAll('th');
      origThs.forEach((th, i) => {
        if (!ghostThs[i]) return;
        (ghostThs[i] as HTMLElement).style.width = (th as HTMLElement).offsetWidth + 'px';
        (ghostThs[i] as HTMLElement).style.minWidth = (th as HTMLElement).offsetWidth + 'px';
      });
      ghostTable.style.width = table!.offsetWidth + 'px';
      const wr = scrollWrap!.getBoundingClientRect();
      ghost.style.left = wr.left + 'px';
      ghost.style.width = wr.width + 'px';
      ghost.scrollLeft = scrollWrap!.scrollLeft;
    }
    function check() {
      const theadRect = thead.getBoundingClientRect();
      const tableRect = table!.getBoundingClientRect();
      if (theadRect.bottom <= STICK_TOP && tableRect.bottom > STICK_TOP + 20) {
        syncGhost();
        ghost.style.visibility = 'visible';
      } else {
        ghost.style.visibility = 'hidden';
      }
    }
    const onWrapScroll = () => {
      if (ghost.style.visibility === 'visible') ghost.scrollLeft = scrollWrap.scrollLeft;
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    scrollWrap.addEventListener('scroll', onWrapScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      scrollWrap.removeEventListener('scroll', onWrapScroll);
      ghost.remove();
    };
  }, [data, teamNamesLen]);

  if (loading && !data) return null;
  if (!data) return null;

  const {
    view, all_dates, team_names, all_teams_data, plans_dict, year, month, projects,
    today_year, today_month, today_wy, today_ww, prev_year, prev_month, next_year, next_month,
    iso_week, prev_wy, prev_ww, next_wy, next_ww, wp_color_even, wp_color_odd,
  } = data;
  const isAdmin = user?.role === 'admin';

  function openWPModal(team?: string, dateISO?: string) {
    const f: Form = { ...emptyForm };
    if (team) f.team_name = team;
    if (dateISO) f.plan_date = dateISO;
    else f.plan_date = view === 'week' ? all_dates[0] : `${year}-${pad2(month)}-01`;
    setAddForm(f);
    setAddOpen(true);
    setTimeout(() => { (team ? addProjectRef.current : addTeamRef.current)?.focus(); }, 100);
  }

  function openEditWPModal(p: any, team: string, dateISO: string) {
    const known = ['confirmed', 'post_ofa', 'schedule_imported', 'qc_not_required'];
    setEditId(p.id);
    setEditForm({
      team_name: team,
      project_name: p.project_name,
      plan_date: dateISO,
      notes: p.notes || '',
      date_confirmed: known.includes(p.date_confirmed) ? p.date_confirmed : 'confirmed',
    });
    setEditOpen(true);
    setTimeout(() => editProjectRef.current?.focus(), 100);
  }

  function showRename(idx: number, teamId: number, currentName: string) {
    setRenameIdx(idx);
    setRenameId(teamId);
    setRenameName(currentName);
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select(); }, 50);
  }

  async function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setAddOpen(false);
    await run('POST', '/api/actions/work-plan/add', fd);
  }
  async function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setEditOpen(false);
    await run('POST', `/api/actions/work-plan/edit/${editId}`, fd);
  }
  async function submitRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setRenameIdx(null);
    await run('POST', `/api/actions/teams/edit/${renameId}`, fd);
  }
  async function deleteTeam(e: React.FormEvent<HTMLFormElement>, id: number, name: string) {
    e.preventDefault();
    if (!confirm('Delete team ' + name + '? Plan entries will remain.')) return;
    await run('POST', `/api/actions/teams/delete/${id}`);
  }
  async function deletePlan(e: React.FormEvent<HTMLFormElement>, id: number) {
    e.preventDefault();
    if (!confirm('Delete this entry?')) return;
    await run('POST', `/api/actions/work-plan/delete/${id}`);
  }

  function showSTToast(type: string, title: string, msg: React.ReactNode, duration = 6000) {
    toastApi.show(type === 'error' ? 'error' : type === 'success' ? 'success' : 'info', msg, { title, duration });
  }

  async function loadFromScheduleTrack() {
    const today = new Date();
    const endDate = new Date(today); endDate.setDate(today.getDate() + 30);
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const confirmed = confirm(
      `Load records from Schedule Track?\n\n` +
      `Date range: ${fmt(today)} → ${fmt(endDate)}\n` +
      `(today to next 1 month)\n\n` +
      `Existing identical entries will be skipped.`
    );
    if (!confirmed) return;

    setStBusy(true);
    try {
      const res: any = await apiPost('/api/work-plan/load-from-schedule-track');
      if (res.status === 0) {
        showSTToast('error', 'Network Error', 'Could not reach the server. Please try again.');
        return;
      }
      if (!(res.status >= 200 && res.status < 300) || !res.ok) {
        showSTToast('error', 'Import Failed', res.error || 'An unexpected error occurred.');
        return;
      }
      if (res.inserted === 0) {
        showSTToast('info', 'Nothing New to Import', res.message + (res.date_range ? ` (${res.date_range})` : ''));
      } else {
        showSTToast('success', `${res.inserted} Record(s) Imported`,
          <>
            {res.message}
            {res.date_range ? (<><br /><small style={{ opacity: 0.8 }}>Range: {res.date_range}</small></>) : null}
          </>,
          8000);
        setTimeout(() => reload(), 1800);
      }
    } catch {
      showSTToast('error', 'Network Error', 'Could not reach the server. Please try again.');
    } finally {
      setStBusy(false);
    }
  }


  const confToggle = (f: Form, setF: (f: Form) => void, prefix: string) => (
    <div className="conf-toggle">
      {CONF_OPTS.map(([val, suffix, icon, label]) => (
        <span key={val} style={{ display: 'contents' }}>
          <input type="radio" name="date_confirmed" id={`${prefix}${suffix}`} className="conf-opt" value={val}
            checked={f.date_confirmed === val} onChange={() => setF({ ...f, date_confirmed: val })} />
          <label htmlFor={`${prefix}${suffix}`} className="conf-lbl">
            <i className={`bi ${icon} me-2`}></i>{label}
          </label>
        </span>
      ))}
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <style>{`:root {\n    --wp-even: ${wp_color_even};\n    --wp-odd:  ${wp_color_odd};\n}`}</style>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-calendar3 me-2" style={{ color: '#10b981' }}></i>QAQC Work Plan
          </h1>
          <p className="page-subtitle">Monthly team project schedule</p>
        </div>
        <div className="d-flex gap-2">
          {isAdmin && (
            <Link href="/teams" className="btn btn-sm d-flex align-items-center gap-2"
              style={{ background: '#fff', color: '#1a1f3a', borderRadius: 10, fontWeight: 600, border: '1.5px solid #e5e7eb', padding: '8px 16px' }}>
              <i className="bi bi-diagram-3-fill"></i> Manage Teams
            </Link>
          )}
          <button id="stLoadBtn" onClick={loadFromScheduleTrack} className="st-btn" disabled={stBusy}>
            <i className={stBusy ? 'bi bi-arrow-repeat st-spin' : 'bi bi-cloud-download-fill'} id="stBtnIcon"></i>
            <span id="stBtnLabel">{stBusy ? 'Loading…' : 'Load from Schedule Track'}</span>
          </button>
          <button onClick={() => openWPModal()} className="btn btn-sm d-flex align-items-center gap-2"
            style={{ background: '#e84c4c', color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', padding: '8px 16px', boxShadow: '0 2px 6px rgba(232,76,76,.3)' }}>
            <i className="bi bi-plus-lg"></i> Add Entry
          </button>
        </div>
      </div>

      {/* View Toggle + Navigator + Legend */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="view-toggle">
            <Link href={`/work-plan?view=week&wy=${today_wy}&ww=${today_ww}`} className={`vt-btn ${view === 'week' ? 'active' : ''}`}>
              <i className="bi bi-calendar-week me-1"></i>Week
            </Link>
            <Link href={`/work-plan?view=month&year=${year}&month=${month}`} className={`vt-btn ${view === 'month' ? 'active' : ''}`}>
              <i className="bi bi-calendar3 me-1"></i>Month
            </Link>
          </div>

          <div className="month-nav-bar">
            {view === 'week' ? (
              <>
                <Link href={`/work-plan?view=week&wy=${prev_wy}&ww=${prev_ww}`} className="mnav-btn" title="Previous Week">
                  <i className="bi bi-chevron-left"></i>
                </Link>
                <span className="mnav-label">
                  Week {iso_week} &nbsp;·&nbsp;
                  {fmtDM(all_dates[0])} – {fmtDMY(all_dates[6])}
                </span>
                <Link href={`/work-plan?view=week&wy=${next_wy}&ww=${next_ww}`} className="mnav-btn" title="Next Week">
                  <i className="bi bi-chevron-right"></i>
                </Link>
                <div className="mnav-sep"></div>
                <Link href={`/work-plan?view=week&wy=${today_wy}&ww=${today_ww}`} className="mnav-today">
                  This Week
                </Link>
              </>
            ) : (
              <>
                <Link href={`/work-plan?view=month&year=${prev_year}&month=${prev_month}`} className="mnav-btn" title="Previous Month">
                  <i className="bi bi-chevron-left"></i>
                </Link>
                <span className="mnav-label">{MONTH_NAMES[month]} {year}</span>
                <Link href={`/work-plan?view=month&year=${next_year}&month=${next_month}`} className="mnav-btn" title="Next Month">
                  <i className="bi bi-chevron-right"></i>
                </Link>
                <div className="mnav-sep"></div>
                <Link href={`/work-plan?view=month&year=${today_year}&month=${today_month}`} className="mnav-today">
                  This Month
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="d-flex gap-3 align-items-center">
          <span className="legend-chip"><span className="legend-swatch" style={{ background: '#1a1f3a' }}></span>Confirmed</span>
          <span className="legend-chip"><span className="legend-swatch" style={{ background: '#dc2626' }}></span>POST OFA/FAB</span>
          <span className="legend-chip"><span className="legend-swatch" style={{ background: '#0d9488' }}></span>Schedule Import</span>
          <span className="legend-chip"><span className="legend-swatch" style={{ background: '#fef3c7', border: '1.5px solid #f59e0b' }}></span>QC Not Required</span>
        </div>
      </div>

      {/* Grid */}
      {!team_names || team_names.length === 0 ? (
        <div className="card p-5 text-center" style={{ borderRadius: 14 }}>
          <i className="bi bi-calendar3 mb-3" style={{ fontSize: '2.5rem', display: 'block', color: '#d1d5db' }}></i>
          <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
            No entries for this month
          </p>
          <button onClick={() => openWPModal()} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, cursor: 'pointer' }}>
            Add the first entry →
          </button>
        </div>
      ) : (
        <div className="card p-0" style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <div id="wp-scroll-wrap" style={{ overflowX: 'auto' }}>
            <table className="wp-table">
              <thead>
                <tr>
                  <th className="team-header">Team</th>
                  {all_dates.map((d: string) => {
                    const p = parseISO(d);
                    const wd = weekday(d);
                    const isOther = view === 'month' && p.m !== month;
                    const isWeekStart = wd === 0;
                    let style: React.CSSProperties = {};
                    if (wd >= 5) {
                      style = { background: '#2a2040' };
                      if (isWeekStart) style.borderLeft = '2px solid #4a3f7a';
                    } else if (isWeekStart) {
                      style = { borderLeft: '2px solid #3b4a6b' };
                    }
                    if (isOther) style.opacity = 0.45;
                    return (
                      <th key={d} style={style}>
                        <span className="th-day">{p.d}</span>
                        <span className="th-dow">{DOW_ABBR[p.dow]}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {team_names.map((team: string, ti: number) => {
                  const idx = ti + 1;
                  const tobj = (all_teams_data || []).find((t: any) => t.name === team);
                  return (
                    <Fragment key={team}>
                      <tr className={`team-row-${ti % 8}`}>
                        <td className="team-cell" id={`tc-${idx}`}>
                          <div className="team-cell-wrap">
                            <span className="team-cell-name">{team}</span>
                            {isAdmin && tobj && (
                              <span className="team-cell-actions">
                                <button className="tc-btn" title="Rename" onClick={() => showRename(idx, tobj.id, team)}>
                                  <i className="bi bi-pencil-fill"></i>
                                </button>
                                <form style={{ margin: 0 }} onSubmit={(e) => deleteTeam(e, tobj.id, team)}>
                                  <button type="submit" className="tc-btn del" title="Delete">
                                    <i className="bi bi-trash-fill"></i>
                                  </button>
                                </form>
                              </span>
                            )}
                          </div>
                        </td>
                        {all_dates.map((d: string) => {
                          const p = parseISO(d);
                          const wd = weekday(d);
                          const cellPlans: any[] = (plans_dict && plans_dict[team] && plans_dict[team][d]) || [];
                          const isOther = view === 'month' && p.m !== month;
                          const isWeekStart = wd === 0;
                          let style: React.CSSProperties | undefined;
                          if (isWeekStart || isOther) {
                            style = {};
                            if (isWeekStart) style.borderLeft = '2px solid #e5e7eb';
                            if (isOther) { style.opacity = 0.35; style.pointerEvents = 'none'; }
                          }
                          return (
                            <td key={d} className={`date-cell ${wd >= 5 ? 'weekend-cell' : ''}`} style={style}>
                              {cellPlans.map((pl: any) => {
                                const dc = pl.date_confirmed;
                                const cls = dc === 'confirmed' ? 'wp-tag-confirmed'
                                  : dc === 'post_ofa' ? 'wp-tag-post_ofa'
                                  : dc === 'schedule_imported' ? 'wp-tag-schedule_imported'
                                  : dc === 'qc_not_required' ? 'wp-tag-qc_not_required'
                                  : 'wp-tag-unconfirmed';
                                return (
                                  <div key={pl.id} className={`wp-tag ${cls}`}
                                    title={`${pl.project_name}${pl.notes ? ` (${pl.notes})` : ''}`}>
                                    <span className="wp-tag-name">
                                      {pl.project_name}{pl.notes ? <span className="wp-tag-notes"> ({pl.notes})</span> : null}
                                    </span>
                                    <span className="wp-tag-actions">
                                      <button type="button" className="wp-act-btn" title="Edit"
                                        onClick={() => openEditWPModal(pl, team, d)}>
                                        <i className="bi bi-pencil-fill"></i>
                                      </button>
                                      <form style={{ margin: 0, display: 'inline' }} onSubmit={(e) => deletePlan(e, pl.id)}>
                                        <button type="submit" className="wp-act-btn del" title="Delete">✕</button>
                                      </form>
                                    </span>
                                  </div>
                                );
                              })}
                              <button className="cell-add-btn" onClick={() => openWPModal(team, d)}>
                                <i className="bi bi-plus"></i>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                      <tr className={`team-rename-row ${renameIdx === idx ? 'show' : ''}`} id={`rename-${idx}`}>
                        <td colSpan={all_dates.length + 1} className="text-start">
                          <form id={`renameForm-${idx}`} className="d-flex align-items-center gap-2" style={{ maxWidth: 400 }}
                            onSubmit={submitRename}>
                            <i className="bi bi-pencil-fill" style={{ color: '#2563eb', flexShrink: 0 }}></i>
                            <input type="text" name="name" id={`renameInput-${idx}`}
                              ref={renameIdx === idx ? renameInputRef : undefined}
                              className="form-control form-control-sm"
                              style={{ borderRadius: 8, border: '1.5px solid #93c5fd' }} required
                              value={renameIdx === idx ? renameName : ''}
                              onChange={(e) => setRenameName(e.target.value)} />
                            <button type="submit" className="btn btn-sm btn-primary px-3" style={{ borderRadius: 8, whiteSpace: 'nowrap' }}>
                              <i className="bi bi-check-lg me-1"></i>Save
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setRenameIdx((c) => (c === idx ? null : c))}>
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </form>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD WORK PLAN MODAL */}
      <div className={`qmodal-bg ${addOpen ? 'open' : ''}`} id="wpModal">
        <div className="qmodal">
          <div className="qm-header">
            <div className="qm-title">
              <span className="qm-icon"><i className="bi bi-plus-lg"></i></span>
              Add Work Plan Entry
            </div>
            <button className="qm-close" onClick={() => setAddOpen(false)}><i className="bi bi-x-lg"></i></button>
          </div>
          <form id="wpForm" onSubmit={submitAdd}>
            <div className="qm-body">
              <div className="mf">
                <label>Team Name<span className="req">*</span></label>
                <input type="text" name="team_name" id="wpTeam" className="mctrl" ref={addTeamRef}
                  placeholder="e.g. COCHIN MAIN STEEL TEAM" list="teamList" required autoComplete="off"
                  value={addForm.team_name} onChange={(e) => setAddForm({ ...addForm, team_name: e.target.value })} />
                <datalist id="teamList">
                  {(team_names || []).map((t: string) => <option key={t} value={t} />)}
                </datalist>
              </div>

              <div className="mf">
                <label>Project Name<span className="req">*</span></label>
                <input type="text" name="project_name" id="wpProject" className="mctrl" ref={addProjectRef}
                  placeholder="e.g. JV Fletcher CO9 Fab" list="pjList" required autoComplete="off"
                  value={addForm.project_name} onChange={(e) => setAddForm({ ...addForm, project_name: e.target.value })} />
                <datalist id="pjList">
                  {(projects || []).map((p: string) => <option key={p} value={p} />)}
                </datalist>
              </div>

              <div className="mgrid2">
                <div className="mf">
                  <label>Date<span className="req">*</span></label>
                  <input type="date" name="plan_date" id="wpDate" className="mctrl" required
                    value={addForm.plan_date} onChange={(e) => setAddForm({ ...addForm, plan_date: e.target.value })} />
                </div>
                <div className="mf">
                  <label>Notes</label>
                  <input type="text" name="notes" className="mctrl" placeholder="Optional"
                    value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
                </div>
              </div>

              <div className="mf">
                <label>Confirmation Status<span className="req">*</span></label>
                {confToggle(addForm, setAddForm, 'conf')}
              </div>
            </div>
            <div className="qm-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-primary px-4">
                <i className="bi bi-check-lg me-1"></i>Save Entry
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* EDIT WORK PLAN MODAL */}
      <div className={`qmodal-bg ${editOpen ? 'open' : ''}`} id="wpEditModal">
        <div className="qmodal">
          <div className="qm-header" style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d5a8e)' }}>
            <div className="qm-title">
              <span className="qm-icon"><i className="bi bi-pencil-fill"></i></span>
              Edit Work Plan Entry
            </div>
            <button className="qm-close" onClick={() => setEditOpen(false)}><i className="bi bi-x-lg"></i></button>
          </div>
          <form id="wpEditForm" onSubmit={submitEdit}>
            <div className="qm-body">
              <div className="mf">
                <label>Team Name<span className="req">*</span></label>
                <input type="text" name="team_name" id="eWpTeam" className="mctrl" list="teamList" required autoComplete="off"
                  value={editForm.team_name} onChange={(e) => setEditForm({ ...editForm, team_name: e.target.value })} />
              </div>

              <div className="mf">
                <label>Project Name<span className="req">*</span></label>
                <input type="text" name="project_name" id="eWpProject" className="mctrl" list="pjList" required autoComplete="off"
                  ref={editProjectRef}
                  value={editForm.project_name} onChange={(e) => setEditForm({ ...editForm, project_name: e.target.value })} />
              </div>

              <div className="mgrid2">
                <div className="mf">
                  <label>Date<span className="req">*</span></label>
                  <input type="date" name="plan_date" id="eWpDate" className="mctrl" required
                    value={editForm.plan_date} onChange={(e) => setEditForm({ ...editForm, plan_date: e.target.value })} />
                </div>
                <div className="mf">
                  <label>Notes</label>
                  <input type="text" name="notes" id="eWpNotes" className="mctrl" placeholder="Optional"
                    value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
              </div>

              <div className="mf">
                <label>Confirmation Status<span className="req">*</span></label>
                {confToggle(editForm, setEditForm, 'eConf')}
              </div>
            </div>
            <div className="qm-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-primary px-4">
                <i className="bi bi-check-lg me-1"></i>Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

    </>
  );
}
