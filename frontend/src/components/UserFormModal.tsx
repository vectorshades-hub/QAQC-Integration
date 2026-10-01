'use client';
import { useEffect, useRef, useState } from 'react';
import { useAction } from '@/context/Flash';
import { apiGet, apiPost } from '@/lib/api';

const css = `
    .uf-label { font-weight: 600; font-size: 0.85rem; color: #374151; margin-bottom: 4px; }
    .uf-section {
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #9ca3af;
        margin: 1.1rem 0 0.6rem;
    }
    .uf-toggle {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px; background: #f9fafb;
        border: 1px solid #e5e7eb; border-radius: 8px;
    }
    .uf-toggle input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; }
`;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const DEF_EVEN = '#ffffff';
const DEF_ODD = '#f5f7ff';
const hint = { color: '#9ca3af', fontSize: '0.78rem' } as const;

type Props = {
  /** 'add' creates a user; 'edit' loads and updates the user with `userId`. */
  mode: 'add' | 'edit';
  userId?: number | string;
  onClose: () => void;
};

export default function UserFormModal({ mode, userId, onClose }: Props) {
  const isEdit = mode === 'edit';
  const run = useAction();
  const [user, setUser] = useState<any>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Work plan theme (edit only)
  const [evenPicker, setEvenPicker] = useState(DEF_EVEN);
  const [evenHex, setEvenHex] = useState(DEF_EVEN);
  const [oddPicker, setOddPicker] = useState(DEF_ODD);
  const [oddHex, setOddHex] = useState(DEF_ODD);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMsg, setThemeMsg] = useState<{ text: string; color: string } | null>(null);
  const msgTimer = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d: any = await apiGet(isEdit ? `/api/pages/users/edit/${userId}` : '/api/pages/users/add');
        if (cancelled) return;
        setTeams(d.teams || []);
        if (isEdit) {
          setUser(d.user);
          try {
            const t: any = await apiGet(`/api/users/${userId}/wp-theme`);
            if (cancelled) return;
            setEvenPicker(t.row_even);
            setEvenHex(t.row_even);
            setOddPicker(t.row_odd);
            setOddHex(t.row_odd);
          } catch {
            /* keep defaults */
          }
        }
        setReady(true);
      } catch {
        if (!cancelled) onClose();
      }
    })();
    return () => {
      cancelled = true;
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res: any = await run('POST', isEdit ? `/api/actions/users/edit/${userId}` : '/api/actions/users/add', new FormData(e.currentTarget));
    setSaving(false);
    if (res.ok === false) {
      setError(res.flash?.[0]?.message || res.error || 'Could not save user.');
    } else {
      onClose(); // the action's redirect to /users reloads the list
    }
  }

  async function saveTheme() {
    setThemeSaving(true);
    try {
      const d: any = await apiPost(`/api/users/${userId}/wp-theme`, { row_even: evenHex, row_odd: oddHex });
      setThemeMsg(
        d.status === 0
          ? { text: 'Network error.', color: '#e84c4c' }
          : { text: d.ok ? '✓ Theme saved.' : d.error || 'Error saving.', color: d.ok ? '#10b981' : '#e84c4c' }
      );
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setThemeMsg(null), 3000);
    } finally {
      setThemeSaving(false);
    }
  }

  function resetTheme() {
    setEvenPicker(DEF_EVEN);
    setEvenHex(DEF_EVEN);
    setOddPicker(DEF_ODD);
    setOddHex(DEF_ODD);
  }

  const colorInput = (label: string, picker: string, hex: string, setP: (v: string) => void, setH: (v: string) => void) => (
    <div>
      <label className="uf-label">{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={picker}
          onChange={(e) => {
            setP(e.target.value);
            setH(e.target.value);
          }}
          style={{ width: 44, height: 38, border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', padding: 2 }}
        />
        <input
          type="text"
          value={hex}
          maxLength={7}
          onChange={(e) => {
            setH(e.target.value);
            if (HEX_RE.test(e.target.value)) setP(e.target.value);
          }}
          className="form-control"
          style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}
        />
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{css}</style>
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 640,
          margin: '1rem',
          maxHeight: 'calc(100vh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
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
            {isEdit ? (
              <>
                <i className="bi bi-person-gear me-2"></i>Edit User{user ? ` — ${user.full_name}` : ''}
              </>
            ) : (
              <>
                <i className="bi bi-person-plus me-2"></i>Add New User
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
          {!ready ? (
            <div className="text-center py-4" style={{ color: '#9ca3af' }}>
              Loading...
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit}>
                <div className="uf-section" style={{ marginTop: 0 }}>
                  Account Info
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="uf-label">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="full_name"
                      placeholder="e.g. Jithin Kumar"
                      defaultValue={user?.full_name || ''}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="uf-label">
                      Email
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      name="email"
                      placeholder="e.g. jithin@company.com"
                      defaultValue={user?.email || ''}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="uf-label">
                      {isEdit ? 'New Password' : 'Password'}
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      name="password"
                      placeholder={isEdit ? 'Leave blank to keep current' : 'Optional — min 6 characters'}
                      autoComplete="new-password"
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="uf-section">Access</div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="uf-label">Role</label>
                    <select className="form-select" name="role" defaultValue={user?.role || 'user'}>
                      <option value="user">User</option>
                      <option value="management">Management</option>
                      <option value="admin">Admin</option>
                    </select>
                    <small style={hint}>User: standard access | Management: reports | Admin: full access</small>
                  </div>
                  <div className="col-md-6">
                    <label className="uf-label">Team</label>
                    <select className="form-select" name="team" defaultValue={user?.team || ''}>
                      <option value="">— No Team —</option>
                      {user?.team && !teams.includes(user.team) && <option value={user.team}>{user.team}</option>}
                      {teams.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isEdit && (
                    <div className="col-12">
                      <div className="uf-toggle">
                        <input type="checkbox" name="is_active" id="ufIsActive" defaultChecked={!!user.is_active} />
                        <label htmlFor="ufIsActive" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                          Account Active
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: 6 }}>(uncheck to deactivate this user)</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="uf-section">Personal Info</div>
                <label className="uf-label">Birthday</label>
                <input
                  type="date"
                  className="form-control"
                  name="birthday"
                  defaultValue={user?.birthday ? String(user.birthday).slice(0, 10) : ''}
                />
                <small style={hint}>For the yearly birthday popup. Only month &amp; day are shown to others.</small>

                {error && (
                  <div
                    style={{
                      marginTop: '1rem',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 8,
                      padding: '0.6rem 0.9rem',
                      fontSize: '0.84rem',
                      color: '#b91c1c',
                    }}
                  >
                    {error}
                  </div>
                )}

                <div className="d-flex gap-2 mt-4 justify-content-end">
                  <button type="button" onClick={onClose} className="btn btn-sm btn-outline-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-accent" disabled={saving}>
                    <i className={`bi ${isEdit ? 'bi-check-lg' : 'bi-person-check'} me-1`}></i>
                    {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </form>

              {isEdit && (
                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '1.5rem', paddingTop: '1.2rem' }}>
                  <div className="uf-section" style={{ marginTop: 0 }}>
                    Work Plan Color Theme
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '1rem' }}>
                    Row colors shown to this user on the Work Plan page. Defaults are <code>#ffffff</code> (even rows) and{' '}
                    <code>#f5f7ff</code> (odd rows).
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
                    {colorInput('Even Row Color', evenPicker, evenHex, setEvenPicker, setEvenHex)}
                    {colorInput('Odd Row Color', oddPicker, oddHex, setOddPicker, setOddHex)}
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
                    <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#374151', background: HEX_RE.test(evenHex) ? evenHex : DEF_EVEN }}>
                      Even row — sample entry
                    </div>
                    <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#374151', background: HEX_RE.test(oddHex) ? oddHex : DEF_ODD }}>
                      Odd row — sample entry
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={saveTheme} disabled={themeSaving} className="btn btn-sm btn-accent" style={{ minWidth: 130 }}>
                      <i className={`bi ${themeSaving ? 'bi-hourglass-split' : 'bi-palette-fill'} me-1`}></i>
                      {themeSaving ? 'Saving…' : 'Save Theme'}
                    </button>
                    <button
                      type="button"
                      onClick={resetTheme}
                      className="btn btn-sm"
                      style={{ border: '1px solid #e5e7eb', color: '#6b7280', borderRadius: 8, padding: '6px 14px' }}
                    >
                      Reset to Default
                    </button>
                    {themeMsg && <span style={{ fontSize: '0.82rem', color: themeMsg.color }}>{themeMsg.text}</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
