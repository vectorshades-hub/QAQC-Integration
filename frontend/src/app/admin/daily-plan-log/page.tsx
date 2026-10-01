'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { usePageData } from '@/hooks/usePageData';

const css = `
.log-action {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 20px;
    font-size: 0.7rem; font-weight: 700; white-space: nowrap;
}
.act-ADD           { background:#d1fae5; color:#065f46; }
.act-EDIT          { background:#dbeafe; color:#1e40af; }
.act-DELETE        { background:#fee2e2; color:#991b1b; }
.act-TRANSFER      { background:#ede9fe; color:#5b21b6; }
.act-WP_CONFIRM_COPY { background:#fef3c7; color:#92400e; }
.act-WP_EDIT       { background:#f0f9ff; color:#0369a1; }
.act-STATUS_CHANGE { background:#fce7f3; color:#9d174d; }

.filter-bar {
    display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;
    background: #fff; border: 1.5px solid #e5e7eb; border-radius: 12px;
    padding: 14px 16px; margin-bottom: 1.25rem;
    box-shadow: 0 2px 8px rgba(0,0,0,.05);
}
.filter-bar label { font-size:.78rem; font-weight:600; color:#374151; display:block; margin-bottom:4px; }
.filter-bar input, .filter-bar select {
    padding: 7px 10px; border: 1.5px solid #d1d5db; border-radius: 8px;
    font-size: .83rem; font-family:'DM Sans',sans-serif; min-width: 140px;
}
.filter-bar input:focus, .filter-bar select:focus {
    outline: none; border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,.12);
}
.btn-filter {
    background: #1a1f3a; color: #fff; border: none;
    border-radius: 8px; padding: 8px 18px;
    font-size: .83rem; font-weight: 600; cursor: pointer;
    transition: background .15s; white-space: nowrap;
}
.btn-filter:hover { background: #2d3a6e; }
.btn-reset {
    background: #f3f4f6; color: #374151; border: none;
    border-radius: 8px; padding: 8px 14px;
    font-size: .83rem; font-weight: 600; cursor: pointer;
}
.btn-reset:hover { background: #e5e7eb; }

.log-tbl { border-collapse: collapse; width: 100%; font-size: .815rem; }
.log-tbl thead th {
    background: #1a1f3a; color: rgba(255,255,255,.78);
    font-family:'Syne',sans-serif; font-size:.67rem; font-weight:700;
    text-transform:uppercase; letter-spacing:.9px;
    padding: 12px 12px; white-space: nowrap;
    position: sticky; top: 0; z-index: 10;
}
.log-tbl td {
    border: 1px solid #f0f2f5; padding: 9px 12px;
    vertical-align: middle;
}
.log-tbl tbody tr:hover td { background: #f8fbff; }
.detail-json {
    font-size:.73rem; color:#6b7280;
    font-family:monospace; max-width:220px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.pagination-bar {
    display: flex; align-items: center; gap: 6px;
    margin-top: 1rem; flex-wrap: wrap;
}
.pg-btn {
    background: #f3f4f6; border: none; border-radius: 7px;
    padding: 6px 12px; font-size: .8rem; font-weight: 600;
    cursor: pointer; color: #374151; transition: all .15s;
}
.pg-btn:hover { background: #1a1f3a; color: #fff; }
.pg-btn.active { background: #1a1f3a; color: #fff; }
.pg-btn:disabled { opacity:.4; cursor:default; }
`;

const ACTION_LABELS: Record<string, string> = {
  ADD: 'Add',
  EDIT: 'Edit',
  STATUS_CHANGE: 'Status Change',
  DELETE: 'Delete',
  WP_CONFIRM_COPY: 'WP → Daily',
  TRANSFER: 'Transfer',
  WP_EDIT: 'WP Edit',
};

function fmtDt(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

function Details({ det }: { det: any }) {
  if (!det || typeof det !== 'object') return <span className="detail-json">—</span>;
  const entries = Object.entries(det).filter(([, v]) => v !== null && v !== undefined && v !== '');
  return (
    <span className="detail-json" title={JSON.stringify(det)}>
      {entries.length
        ? entries.map(([k, v], i) => (
            <span key={k}>
              {i > 0 ? ' · ' : ''}
              <b>{k}:</b> {String(v)}
            </span>
          ))
        : '—'}
    </span>
  );
}

export default function DailyPlanLogPage() {
  const [fAction, setFAction] = useState('');
  const [fUser, setFUser] = useState('');
  const [fDate, setFDate] = useState('');
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  // The Flask page was admin_required (flash "Admin only." + redirect to the dashboard); this call applies that for non-admins.
  usePageData('/api/pages/admin/daily-plan-log');

  const loadLog = async (p: number, action = fAction, user = fUser, dt = fDate) => {
    setPage(p);
    const params = new URLSearchParams({ page: String(p) });
    if (action) params.set('action', action);
    if (user) params.set('user', user);
    if (dt) params.set('date', dt);
    try {
      const d = await apiGet('/api/admin/daily-plan-log?' + params);
      setData(d);
    } catch {
      /* unauthorized / forbidden are handled by the api helper */
    }
  };

  useEffect(() => {
    loadLog(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetFilter = () => {
    setFAction('');
    setFUser('');
    setFDate('');
    loadLog(1, '', '', '');
  };

  const rows: any[] = data?.rows || [];
  const pages: number = data?.pages || 0;
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  const pageNums: number[] = [];
  for (let p = start; p <= end; p++) pageNums.push(p);

  return (
    <>
      <style>{css}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-journal-text me-2" style={{ color: '#6366f1', fontSize: '1.3rem' }}></i>
            Daily Plan Audit Log
          </h1>
          <p className="page-subtitle">Track all changes to daily work plan entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div>
          <label>Action</label>
          <select id="f-action" value={fAction} onChange={(e) => setFAction(e.target.value)}>
            <option value="">All Actions</option>
            <option value="ADD">Add</option>
            <option value="EDIT">Edit</option>
            <option value="STATUS_CHANGE">Status Change</option>
            <option value="DELETE">Delete</option>
            <option value="WP_CONFIRM_COPY">WP Confirm Copy</option>
            <option value="TRANSFER">Transfer</option>
            <option value="WP_EDIT">WP Edit</option>
          </select>
        </div>
        <div>
          <label>User (performed by / target)</label>
          <input type="text" id="f-user" placeholder="Search name..." value={fUser} onChange={(e) => setFUser(e.target.value)} />
        </div>
        <div>
          <label>Date</label>
          <input type="date" id="f-date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, paddingTop: 19 }}>
          <button className="btn-filter" onClick={() => loadLog(1)}>
            <i className="bi bi-search me-1"></i>Filter
          </button>
          <button className="btn-reset" onClick={resetFilter}>
            Reset
          </button>
        </div>
        <div style={{ marginLeft: 'auto', paddingTop: 19 }}>
          <span id="log-count" style={{ fontSize: '.8rem', color: '#6b7280' }}>
            {data ? `${data.total} record${data.total !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0" style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,.07)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="log-tbl">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Timestamp</th>
                <th style={{ width: 120 }}>Action</th>
                <th style={{ width: 140 }}>Performed By</th>
                <th style={{ width: 140 }}>Target User</th>
                <th style={{ width: 90 }}>Plan Date</th>
                <th style={{ width: 80 }}>Entry ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="log-body">
              {!data ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: '#6b7280', fontSize: '.78rem' }}>{fmtDt(r.created_at)}</td>
                    <td>
                      <span className={`log-action act-${r.action}`}>{ACTION_LABELS[r.action] || r.action}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.performed_by_name || '—'}</td>
                    <td>{r.target_user_name || '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: '.78rem', color: '#374151' }}>{r.plan_date || '—'}</td>
                    <td style={{ fontSize: '.72rem', fontFamily: 'monospace', color: '#9ca3af' }}>
                      {r.entry_id || (r.wp_id ? 'WP#' + r.wp_id : '—')}
                    </td>
                    <td>
                      <Details det={r.details} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="pagination-bar" id="pag-bar">
        {data && rows.length > 0 && pages > 1 && (
          <>
            <button className="pg-btn" disabled={page <= 1} onClick={() => loadLog(page - 1)}>
              <i className="bi bi-chevron-left"></i>
            </button>
            {pageNums.map((p) => (
              <button key={p} className={`pg-btn ${p === page ? 'active' : ''}`} onClick={() => loadLog(p)}>
                {p}
              </button>
            ))}
            <button className="pg-btn" disabled={page >= pages} onClick={() => loadLog(page + 1)}>
              <i className="bi bi-chevron-right"></i>
            </button>
            <span style={{ fontSize: '.78rem', color: '#9ca3af', marginLeft: 4 }}>
              Page {page} of {pages}
            </span>
          </>
        )}
      </div>
    </>
  );
}
