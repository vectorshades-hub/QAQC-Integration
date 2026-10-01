'use client';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePageData } from '@/hooks/usePageData';
import { useFlash } from '@/context/Flash';
import { useSession } from '@/context/Session';
import { apiPost } from '@/lib/api';

// Original page was standalone (no base.html). Its CSS is scoped under .login-page and the
// wrapper covers the whole viewport so the shell chrome (if any) is not visible.
const css = `
.login-page {
    --primary: #1a1f3a; --accent: #e84c4c;
    position: fixed; inset: 0; z-index: 5000; overflow: auto;
    font-family: 'DM Sans', sans-serif; min-height: 100vh;
    background: linear-gradient(135deg, #1a1f3a 0%, #2d3561 50%, #1a1f3a 100%);
    display: flex; align-items: center; justify-content: center; padding: 2rem 1rem;
}
.login-page .login-card {
    background: #fff; border-radius: 16px; padding: 2.5rem; margin: auto;
    width: 100%; max-width: 420px; box-shadow: 0 24px 64px rgba(0,0,0,0.3);
}
.login-page .login-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:1.5rem; color:var(--primary); text-align:center; margin-bottom:0.4rem; }
.login-page .login-logo .dot { color: var(--accent); }
.login-page .login-subtitle { text-align:center; color:#6b7280; font-size:0.875rem; margin-bottom:2rem; }
.login-page .form-label { font-weight:500; font-size:0.875rem; color:var(--primary); }
.login-page .form-control { border-radius:8px; border-color:#e5e7eb; padding:10px 14px; font-size:0.9rem; }
.login-page .form-control:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(26,31,58,0.1); }
.login-page .btn-login { background:var(--primary); color:#fff; border:none; border-radius:8px; padding:11px; font-weight:600; font-size:0.95rem; width:100%; transition:background 0.2s,transform 0.1s; font-family:'Syne',sans-serif; }
.login-page .btn-login:hover { background:#2d3561; transform:translateY(-1px); }
.login-page .alert { border-radius:8px; font-size:0.875rem; border:none; }
.login-page .input-group-text { background:#f8f9fc; border-color:#e5e7eb; color:#6b7280; border-radius:8px 0 0 8px; }

/* ── User Dropdown ── */
.login-page .ud-wrap { position:relative; }
.login-page .ud-trigger {
    width:100%; padding:9px 14px; border:1.5px solid #e5e7eb; border-radius:8px;
    background:#fff; cursor:pointer; display:flex; align-items:center; gap:10px;
    font-size:0.9rem; color:#374151; transition:border-color .15s; user-select:none;
}
.login-page .ud-trigger:focus, .login-page .ud-trigger.open { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px rgba(26,31,58,0.1); }
.login-page .ud-trigger.error { border-color:#ef4444; }
.login-page .ud-av-sm { width:28px; height:28px; border-radius:50%; color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:700; flex-shrink:0; }
.login-page .ud-placeholder { color:#9ca3af; }
.login-page .ud-caret { margin-left:auto; color:#9ca3af; font-size:0.8rem; }
.login-page .ud-dropdown {
    display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:300;
    background:#fff; border:1.5px solid #e5e7eb; border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.12); overflow:hidden;
}
.login-page .ud-dropdown.open { display:block; }
.login-page .ud-search-wrap { padding:10px; border-bottom:1px solid #f0f2f5; }
.login-page .ud-search { width:100%; border:1px solid #e5e7eb; padding:7px 12px; border-radius:7px; font-size:0.85rem; font-family:'DM Sans',sans-serif; outline:none; }
.login-page .ud-search:focus { border-color:var(--primary); }
.login-page .ud-list { max-height:210px; overflow-y:auto; }
.login-page .ud-option { display:flex; align-items:center; gap:10px; padding:9px 14px; cursor:pointer; font-size:0.88rem; color:#374151; transition:background .1s; }
.login-page .ud-option:hover { background:#f0f4ff; }
.login-page .ud-option.selected { background:#eff6ff; font-weight:600; }
.login-page .ud-sub { font-size:0.73rem; color:#9ca3af; }
.login-page .ud-no-results { padding:14px; text-align:center; color:#9ca3af; font-size:0.85rem; display:none; }
`;

const PALETTE = ['#1a1f3a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#e84c4c', '#06b6d4'];

type LoginUser = { id: number; full_name: string };

export default function LoginPage() {
  const { data } = usePageData<{ all_users: LoginUser[] }>('/api/pages/login');
  const { messages, applyResult } = useFlash();
  const { refresh } = useSession();

  const allUsers: LoginUser[] = useMemo(() => data?.all_users || [], [data]);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [selIdx, setSelIdx] = useState<number>(-1);
  const [error, setError] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const errTimer = useRef<any>(null);

  // close on outside click / Escape
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      if (errTimer.current) clearTimeout(errTimer.current);
    };
  }, []);

  function toggleDrop() {
    const next = !open;
    setOpen(next);
    if (next) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }

  const q = search.toLowerCase();
  const matches = (u: LoginUser) => u.full_name.toLowerCase().includes(q);
  const anyMatch = allUsers.some(matches);

  function selectUser(u: LoginUser, idx: number) {
    setUserId(String(u.id));
    setSelIdx(idx);
    setError(false);
    setOpen(false);
    pwRef.current?.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) {
      setError(true);
      triggerRef.current?.focus();
      if (errTimer.current) clearTimeout(errTimer.current);
      errTimer.current = setTimeout(() => setError(false), 2500);
      return;
    }
    const fd = new FormData();
    fd.append('user_id', userId);
    fd.append('password', pwRef.current?.value || '');
    setBusy(true);
    const res = await apiPost('/api/auth/login', fd);
    setBusy(false);
    if (res.ok) await refresh(); // shell must know the user before navigating
    else {
      // Flask re-rendered the login page: selection and password are cleared
      setUserId('');
      setSelIdx(-1);
      if (pwRef.current) pwRef.current.value = '';
      setShowPw(false);
    }
    applyResult(res);
  }

  const selUser = selIdx >= 0 ? allUsers[selIdx] : null;
  const selColor = selIdx >= 0 ? PALETTE[selIdx % PALETTE.length] : '#1a1f3a';

  return (
    <div className="login-page">
      <style>{css}</style>
      <div className="login-card">
        <div className="login-logo">
          QA<span className="dot">•</span>QC
        </div>
        <p className="login-subtitle">Integration Platform — Sign in to continue</p>

        {messages.map((m, i) => (
          <div key={i} className={`alert alert-${m.category}`}>
            {m.message}
          </div>
        ))}

        <form id="login-form" onSubmit={onSubmit}>
          <input type="hidden" name="user_id" id="user-id-hidden" value={userId} readOnly />

          {/* User dropdown */}
          <div className="mb-3">
            <label className="form-label">Select User</label>
            <div className="ud-wrap" ref={wrapRef}>
              <div
                className={'ud-trigger' + (open ? ' open' : '') + (error ? ' error' : '')}
                id="ud-trigger"
                tabIndex={0}
                ref={triggerRef}
                onClick={toggleDrop}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleDrop();
                  }
                }}
              >
                <div
                  className="ud-av-sm"
                  id="ud-trig-av"
                  style={selUser ? { display: 'flex', background: selColor } : { display: 'none', background: '#1a1f3a' }}
                >
                  {selUser ? selUser.full_name[0].toUpperCase() : ''}
                </div>
                <span id="ud-trig-lbl" className={selUser ? '' : 'ud-placeholder'}>
                  {selUser ? selUser.full_name : 'Choose a user…'}
                </span>
                <i className={'ud-caret bi bi-' + (open ? 'chevron-up' : 'chevron-down')} id="ud-caret"></i>
              </div>
              <div className={'ud-dropdown' + (open ? ' open' : '')} id="ud-dropdown">
                <div className="ud-search-wrap">
                  <input
                    className="ud-search"
                    id="ud-search"
                    type="text"
                    placeholder="Search name…"
                    autoComplete="off"
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="ud-list" id="ud-list">
                  {allUsers.map((u, i) => (
                    <div
                      key={u.id}
                      className={'ud-option' + (selIdx === i ? ' selected' : '')}
                      data-name={u.full_name}
                      data-color={PALETTE[i % PALETTE.length]}
                      style={matches(u) ? undefined : { display: 'none' }}
                      onClick={() => selectUser(u, i)}
                    >
                      <div className="ud-av-sm ud-av-item" data-color={PALETTE[i % PALETTE.length]} style={{ background: PALETTE[i % PALETTE.length] }}>
                        {u.full_name[0].toUpperCase()}
                      </div>
                      <div>{u.full_name}</div>
                    </div>
                  ))}
                </div>
                <div className="ud-no-results" id="ud-no-results" style={{ display: anyMatch ? 'none' : 'block' }}>
                  No users found.
                </div>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="mb-3">
            <label className="form-label">Password</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-lock"></i>
              </span>
              <input
                type={showPw ? 'text' : 'password'}
                className="form-control"
                name="password"
                id="pw-field"
                ref={pwRef}
                placeholder="Enter password"
                required
                style={{ borderRadius: '0 0 0 0' }}
              />
              <button
                type="button"
                id="pw-toggle"
                onClick={() => setShowPw((s) => !s)}
                style={{ background: '#f8f9fc', border: '1px solid #e5e7eb', borderLeft: 'none', borderRadius: '0 8px 8px 0', padding: '0 12px', cursor: 'pointer' }}
              >
                <i className={showPw ? 'bi bi-eye-slash' : 'bi bi-eye'} id="pw-eye"></i>
              </button>
            </div>
          </div>

          <button type="submit" className="btn-login" disabled={busy}>
            <i className="bi bi-box-arrow-in-right me-2"></i>Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
