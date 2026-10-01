'use client';
import { useRef, useState } from 'react';
import { usePageData } from '@/hooks/usePageData';
import { useSession } from '@/context/Session';
import { useAction } from '@/context/Flash';
import { apiPost } from '@/lib/api';
import UserFormModal from '@/components/UserFormModal';

const css = `
    .user-avatar {
        width: 38px; height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        font-size: 0.9rem;
        flex-shrink: 0;
        color: #fff;
    }
    .filter-bar {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
    }
    .filter-bar input, .filter-bar select {
        border: 1px solid #e5e7eb;
        border-radius: 7px;
        padding: 5px 10px;
        font-size: 0.875rem;
        outline: none;
        font-family: 'DM Sans', sans-serif;
    }
    .filter-bar input:focus, .filter-bar select:focus { border-color: #1a1f3a; }
    .inactive-row { opacity: 0.55; }
    .stat-card {
        background: #fff; border: 1px solid #eef0f4; border-radius: 14px;
        padding: 1rem 1.15rem; display: flex; align-items: center; gap: 14px;
        box-shadow: 0 1px 2px rgba(17,24,39,.04); transition: transform .15s, box-shadow .15s;
    }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(17,24,39,.08); }
    .stat-icon {
        width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center; font-size: 1.3rem;
    }
    .stat-num { font-family: 'Syne', sans-serif; font-size: 1.7rem; font-weight: 800; line-height: 1; }
    .stat-label { font-size: .78rem; color: #6b7280; margin-top: 4px; }
    .users-table tbody tr { transition: background .12s; }
    .users-table tbody tr:hover { background: #f8faff; }
    .team-chip {
        display: inline-block; padding: 2px 10px; border-radius: 20px;
        background: #eef2ff; color: #4338ca; font-size: .76rem; font-weight: 600;
    }
    .act-btn {
        width: 30px; height: 30px; border-radius: 8px; display: inline-flex;
        align-items: center; justify-content: center; background: #fff;
        border: 1px solid; font-size: .85rem; cursor: pointer; padding: 0; transition: all .12s;
    }
    .act-btn:hover { color: #fff !important; }
    .act-edit { border-color: #3b82f6; color: #3b82f6; } .act-edit:hover { background: #3b82f6; }
    .act-warn { border-color: #f59e0b; color: #f59e0b; } .act-warn:hover { background: #f59e0b; }
    .act-ok { border-color: #10b981; color: #10b981; } .act-ok:hover { background: #10b981; }
    .act-del { border-color: #ef4444; color: #ef4444; } .act-del:hover { background: #ef4444; }
    .filter-bar { box-shadow: 0 1px 2px rgba(17,24,39,.04); }
    .filter-bar .search-wrap { position: relative; flex: 1; min-width: 200px; }
    .filter-bar .search-wrap i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; }
    .filter-bar .search-wrap input { width: 100%; padding-left: 34px; height: 36px; }
    .filter-bar select { height: 36px; }
    .user-count-badge {
        background: #1a1f3a;
        color: #fff;
        border-radius: 20px;
        padding: 2px 10px;
        font-size: 0.78rem;
        font-weight: 600;
    }
`;

const COLORS = ['#1a1f3a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#e84c4c', '#06b6d4'];

type ImportResult = { type: 'success' | 'error'; body: React.ReactNode } | null;

export default function UsersPage() {
  const { user } = useSession();
  const SESSION_UID = parseInt(String(user?.user_id ?? 0), 10) || 0;
  const run = useAction();
  // The Flask /users page was admin_required (flash "Admin only." + redirect to the dashboard); this call applies that for non-admins.
  usePageData('/api/pages/users');
  const { data, error, reload } = usePageData<{ items: any[] }>('/api/users?per_page=500');
  const allUsers: any[] | null = data ? data.items || [] : null;

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [userModal, setUserModal] = useState<{ mode: 'add' | 'edit'; id?: number } | null>(null);

  // Bulk import state
  const [modalOpen, setModalOpen] = useState(false);
  const [chosenFile, setChosenFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult>(null);
  const [dzColor, setDzColor] = useState('#d1d5db');
  const fileRef = useRef<HTMLInputElement>(null);

  function openBulkImport() {
    setModalOpen(true);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
    setChosenFile(null);
  }
  function closeBulkImport() {
    setModalOpen(false);
  }
  function fileChosen(input: HTMLInputElement) {
    if (input.files && input.files.length) {
      setChosenFile(input.files[0]);
      setDzColor('#10b981');
    }
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDzColor('#d1d5db');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      setChosenFile(file);
      setDzColor('#10b981');
    } else {
      setResult({ type: 'error', body: 'Please drop a valid .xlsx file.' });
    }
  }
  async function runBulkImport() {
    if (!chosenFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', chosenFile);
    const d: any = await apiPost('/api/actions/users/bulk-import', fd);
    if (d.status === 0) {
      setResult({ type: 'error', body: 'Network error: ' + (d.error || '') });
    } else if (d.ok) {
      setResult({
        type: 'success',
        body: (
          <>
            <strong>Done!</strong> Added: {d.added}, Updated: {d.updated}
            {d.skipped ? `, Skipped (blank rows): ${d.skipped}` : ''}
            {d.errors && d.errors.length ? (
              <div className="mt-2" style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                {d.errors.map((e: any, i: number) => (
                  <div key={i}>⚠ {String(e)}</div>
                ))}
              </div>
            ) : null}
          </>
        ),
      });
      reload();
    } else {
      setResult({ type: 'error', body: d.error || 'Import failed.' });
    }
    setImporting(false);
  }

  const q = search.toLowerCase();
  const rows = (allUsers || []).filter((u) => {
    const nm = (u.full_name || '').toLowerCase().includes(q);
    const rm = !role || u.role === role;
    const sm = !status || (status === 'active' ? u.is_active : !u.is_active);
    return nm && rm && sm;
  });

  async function postWithConfirm(e: React.FormEvent<HTMLFormElement>, path: string, msg?: string) {
    e.preventDefault();
    if (msg && !confirm(msg)) return;
    await run('POST', path);
  }

  return (
    <>
      <style>{css}</style>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-people me-2" style={{ color: '#f59e0b' }}></i>Users
          </h1>
          <p className="page-subtitle">Manage team members and their access</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <a
            href="/api/actions/users/export-excel"
            className="btn btn-sm"
            style={{ border: '1px solid #10b981', color: '#10b981', borderRadius: 7 }}
          >
            <i className="bi bi-download me-1"></i>Export Excel
          </a>
          <button
            className="btn btn-sm"
            style={{ border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: 7 }}
            onClick={openBulkImport}
          >
            <i className="bi bi-upload me-1"></i>Bulk Import
          </button>
          <button className="btn btn-accent btn-sm" onClick={() => setUserModal({ mode: 'add' })}>
            <i className="bi bi-person-plus me-1"></i>Add User
          </button>
        </div>
      </div>

      {userModal && <UserFormModal mode={userModal.mode} userId={userModal.id} onClose={() => setUserModal(null)} />}

      {/* Bulk Import Modal */}
      <div
        id="bulkImportModal"
        style={{
          display: modalOpen ? 'flex' : 'none',
          position: 'fixed',
          inset: 0,
          zIndex: 1050,
          background: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeBulkImport();
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            width: '100%',
            maxWidth: 520,
            margin: '1rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}
        >
          <div
            style={{
              background: '#1a1f3a',
              color: '#fff',
              padding: '1rem 1.25rem',
              borderRadius: '12px 12px 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>
              <i className="bi bi-upload me-2"></i>Bulk Import Users
            </span>
            <button
              onClick={closeBulkImport}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 8,
                padding: '0.75rem 1rem',
                fontSize: '0.82rem',
                color: '#0369a1',
                marginBottom: '1rem',
              }}
            >
              <i className="bi bi-info-circle me-1"></i>
              <strong>Workflow:</strong> Export Excel → Modify → Upload back.
              <br />
              New users need a password. Existing users (matched by full name) will be updated. Leave password blank to keep
              current.
            </div>
            <div
              id="dropZone"
              style={{
                border: '2px dashed',
                borderColor: dzColor,
                borderRadius: 10,
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDzColor('#3b82f6');
              }}
              onDragLeave={() => setDzColor('#d1d5db')}
              onDrop={handleDrop}
            >
              <i className="bi bi-file-earmark-excel" style={{ fontSize: '2.5rem', color: '#10b981' }}></i>
              <div style={{ marginTop: '0.5rem', fontWeight: 600, color: '#1a1f3a' }}>Drop .xlsx file here</div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>or click to browse</div>
              <div id="chosenFile" style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#3b82f6', fontWeight: 600 }}>
                {chosenFile ? chosenFile.name : ''}
              </div>
            </div>
            <input
              type="file"
              id="bulkFile"
              accept=".xlsx"
              style={{ display: 'none' }}
              ref={fileRef}
              onChange={(e) => fileChosen(e.currentTarget)}
            />
            {result && (
              <div
                id="importResult"
                style={{
                  display: 'block',
                  marginTop: '0.75rem',
                  background: result.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${result.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  fontSize: '0.84rem',
                  color: result.type === 'success' ? '#15803d' : '#b91c1c',
                }}
              >
                {result.body}
              </div>
            )}
            <div className="d-flex gap-2 mt-3 justify-content-end">
              <button onClick={closeBulkImport} className="btn btn-sm btn-outline-secondary">
                Cancel
              </button>
              <button
                id="importBtn"
                onClick={runBulkImport}
                className="btn btn-sm btn-primary"
                disabled={!chosenFile || importing}
              >
                {importing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>Importing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-upload me-1"></i>Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-3">
        {[
          { id: 'stat-total', label: 'Total Users', icon: 'bi-people-fill', color: '#1a1f3a', bg: '#eceef7', n: allUsers?.length },
          { id: 'stat-active', label: 'Active', icon: 'bi-person-check-fill', color: '#10b981', bg: '#e7f8f1', n: allUsers?.filter((u) => u.is_active).length },
          { id: 'stat-admin', label: 'Admins', icon: 'bi-shield-lock-fill', color: '#e84c4c', bg: '#fdeceb', n: allUsers?.filter((u) => u.role === 'admin').length },
          { id: 'stat-mgmt', label: 'Management', icon: 'bi-briefcase-fill', color: '#f59e0b', bg: '#fef5e0', n: allUsers?.filter((u) => u.role === 'management').length },
        ].map((c) => (
          <div className="col-6 col-md-3" key={c.id}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: c.bg, color: c.color }}>
                <i className={`bi ${c.icon}`}></i>
              </div>
              <div>
                <div id={c.id} className="stat-num" style={{ color: c.color }}>
                  {c.n ?? '—'}
                </div>
                <div className="stat-label">{c.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-wrap">
          <i className="bi bi-search"></i>
          <input
            type="text"
            id="searchInput"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select id="roleFilter" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="management">Management</option>
          <option value="user">User</option>
        </select>
        <select id="statusFilter" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>
            <i className="bi bi-person-lines-fill me-2"></i>All Team Members
          </span>
          <span className="user-count-badge" id="visibleCount">
            {allUsers ? rows.length : '—'}
          </span>
        </div>
        <div className="table-responsive">
          <table className="table table-modern mb-0 users-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Team</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="usersTableBody">
              {error ? (
                <tr>
                  <td colSpan={7} className="text-center py-4" style={{ color: '#e84c4c' }}>
                    Error loading users: {error.status ? 'HTTP ' + error.status : error.message}
                  </td>
                </tr>
              ) : !allUsers ? (
                <tr>
                  <td colSpan={7} className="text-center py-4" style={{ color: '#9ca3af' }}>
                    Loading users...
                  </td>
                </tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={7} className="text-center py-4" style={{ color: '#9ca3af' }}>
                    <i className="bi bi-people" style={{ fontSize: '2rem', display: 'block', marginBottom: 6 }}></i>
                    No users found.
                  </td>
                </tr>
              ) : (
                rows.map((u, i) => {
                  const color = COLORS[i % COLORS.length];
                  const initial = (u.full_name || '?')[0].toUpperCase();
                  const joined = (u.created_at || '').toString().slice(0, 10) || '—';
                  return (
                    <tr key={u.id} className={u.is_active ? '' : 'inactive-row'}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="user-avatar" style={{ background: color }}>
                            {initial}
                          </div>
                          <div style={{ fontWeight: 600, color: '#1a1f3a' }}>{u.full_name}</div>
                        </div>
                      </td>
                      <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{u.email || ''}</td>
                      <td>
                        <span className={`role-badge role-${u.role}`}>{u.role}</span>
                      </td>
                      <td>{u.team ? <span className="team-chip">{u.team}</span> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                      <td>
                        {u.is_active ? (
                          <span className="status-badge status-completed">
                            <i className="bi bi-circle-fill" style={{ fontSize: '0.5rem' }}></i> Active
                          </span>
                        ) : (
                          <span className="status-badge" style={{ background: '#f3f4f6', color: '#9ca3af' }}>
                            <i className="bi bi-circle" style={{ fontSize: '0.5rem' }}></i> Inactive
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{joined}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            type="button"
                            onClick={() => setUserModal({ mode: 'edit', id: u.id })}
                            className="act-btn act-edit"
                            title="Edit"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          {u.id !== SESSION_UID && (
                            <>
                              {u.is_active ? (
                                <form
                                  style={{ display: 'inline' }}
                                  onSubmit={(e) =>
                                    postWithConfirm(e, `/api/actions/users/delete/${u.id}`, `Deactivate ${u.full_name}?`)
                                  }
                                >
                                  <button
                                    className="act-btn act-warn"
                                    title="Deactivate"
                                  >
                                    <i className="bi bi-person-dash"></i>
                                  </button>
                                </form>
                              ) : (
                                <form
                                  style={{ display: 'inline' }}
                                  onSubmit={(e) => postWithConfirm(e, `/api/actions/users/restore/${u.id}`)}
                                >
                                  <button
                                    className="act-btn act-ok"
                                    title="Restore"
                                  >
                                    <i className="bi bi-person-check"></i>
                                  </button>
                                </form>
                              )}
                              <form
                                style={{ display: 'inline' }}
                                onSubmit={(e) =>
                                  postWithConfirm(
                                    e,
                                    `/api/actions/users/hard-delete/${u.id}`,
                                    `PERMANENTLY delete ${u.full_name}? This cannot be undone.`
                                  )
                                }
                              >
                                <button
                                  className="act-btn act-del"
                                  title="Permanently Delete"
                                >
                                  <i className="bi bi-trash-fill"></i>
                                </button>
                              </form>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
