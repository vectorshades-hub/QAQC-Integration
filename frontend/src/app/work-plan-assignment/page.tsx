'use client';
import { useEffect, useRef, useState } from 'react';
import { usePageData } from '@/hooks/usePageData';
import { apiGet, apiPost, apiSend } from '@/lib/api';

const css = `
.team-card {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 14px;
    margin-bottom: 1rem;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.team-card-header {
    background: linear-gradient(135deg, #1a1f3a 0%, #2d3a6e 100%);
    color: #fff;
    padding: 12px 18px;
    display: flex; align-items: center; justify-content: space-between;
}
.team-card-title {
    font-family: 'Syne', sans-serif;
    font-weight: 700; font-size: 0.95rem;
    display: flex; align-items: center; gap: 8px;
}
.team-card-body { padding: 16px 18px; }

.assign-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 0; border-bottom: 1px solid #f0f2f5;
}
.assign-row:last-child { border-bottom: none; }
.assign-user {
    font-weight: 600; font-size: 0.87rem; color: #1a1f3a; flex: 1;
}
.default-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 20px;
    font-size: 0.7rem; font-weight: 700;
    background: #fef3c7; color: #92400e;
}
.btn-sm-icon {
    background: none; border: 1.5px solid #e5e7eb;
    border-radius: 7px; padding: 4px 8px;
    font-size: 0.75rem; cursor: pointer;
    transition: all 0.15s;
}
.btn-sm-icon:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }
.btn-sm-icon.make-default { border-color: #fde68a; }
.btn-sm-icon.make-default:hover { background: #fef3c7; border-color: #fcd34d; color: #92400e; }

.empty-assign { color: #9ca3af; font-style: italic; font-size: 0.83rem; padding: 8px 0; }

/* Add user section */
.add-assign-form {
    display: flex; gap: 8px; align-items: center; margin-top: 12px;
    padding-top: 12px; border-top: 1.5px dashed #e5e7eb;
    flex-wrap: wrap;
}
.add-assign-form select {
    flex: 1; min-width: 160px;
    padding: 7px 10px; border: 1.5px solid #d1d5db;
    border-radius: 8px; font-size: 0.83rem;
    font-family: 'DM Sans', sans-serif;
}
.add-assign-form select:focus {
    outline: none; border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,.12);
}
.btn-add-assign {
    background: #1a1f3a; color: #fff; border: none;
    border-radius: 8px; padding: 7px 16px;
    font-size: 0.82rem; font-weight: 600;
    cursor: pointer; white-space: nowrap;
    transition: background 0.15s;
}
.btn-add-assign:hover { background: #2d3a6e; }

/* Transfer panel */
.transfer-card {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 14px;
    padding: 20px 22px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.transfer-row {
    display: grid; grid-template-columns: 1fr auto 1fr;
    gap: 12px; align-items: end;
}
.tctrl {
    width: 100%; padding: 9px 12px;
    border: 1.5px solid #e5e7eb; border-radius: 9px;
    font-size: 0.875rem; font-family: 'DM Sans', sans-serif;
    box-sizing: border-box;
}
.tctrl:focus { outline: none; border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
.transfer-arrow {
    font-size: 1.4rem; color: #9ca3af; padding-bottom: 10px;
    text-align: center;
}

.toast-msg {
    position: fixed; top: 80px; right: 1.5rem; z-index: 9999;
    padding: 12px 20px; border-radius: 10px;
    font-size: 0.875rem; font-weight: 600;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    opacity: 0; transform: translateY(-10px);
    transition: opacity .25s ease, transform .25s ease;
    pointer-events: none;
}
.toast-msg.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
.toast-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.toast-error   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
`;

const TEAM_KEY = (t: string) => t.replace(/ /g, '_').replace(/\./g, '');

export default function WorkPlanAssignmentPage() {
  const { data, loading, reload } = usePageData<any>('/api/pages/work-plan-assignment');

  const [selMap, setSelMap] = useState<Record<string, string>>({});
  const [defMap, setDefMap] = useState<Record<string, boolean>>({});
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trDateFrom, setTrDateFrom] = useState('');
  const [trDateTo, setTrDateTo] = useState('');
  const [trResult, setTrResult] = useState<{ text: string; color: string }>({ text: '', color: '' });
  const [toast, setToast] = useState<{ msg: string; type: string; show: boolean }>({ msg: '', type: 'success', show: false });
  const timers = useRef<any[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  if (loading && !data) return null;
  if (!data) return null;
  const teams: any[] = data.teams || [];
  const users: any[] = data.users || [];
  const assignMap: Record<string, any[]> = data.assign_map || {};

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type, show: true });
    timers.current.push(setTimeout(() => setToast((t) => ({ ...t, show: false })), 2800));
  }
  // Flask did location.reload(): a full page reload also resets every form control and the toast.
  function reloadPage() {
    setSelMap({}); setDefMap({});
    setTrFrom(''); setTrTo(''); setTrDateFrom(''); setTrDateTo('');
    setTrResult({ text: '', color: '' });
    setToast((t) => ({ ...t, show: false }));
    reload();
  }

  async function addAssign(teamName: string) {
    const key = TEAM_KEY(teamName);
    const userId = selMap[key] || '';
    const isDef = !!defMap[key];
    if (!userId) { showToast('Please select a user.', 'error'); return; }

    const data2: any = await apiGet('/api/work-plan-assignment');
    const existing = (data2.assignments || []).filter((a: any) => a.team_name === teamName);
    const existIds = existing.map((a: any) => String(a.user_id));
    if (existIds.includes(String(userId))) {
      showToast('User already assigned to this team.', 'error'); return;
    }

    const newList = existing.map((a: any) => ({ user_id: a.user_id, is_default: a.is_default }));
    newList.push({ user_id: parseInt(userId), is_default: isDef });

    let defaultId: number | null = null;
    if (isDef) {
      defaultId = parseInt(userId);
    } else {
      const oldDef = existing.find((a: any) => a.is_default);
      if (oldDef) defaultId = oldDef.user_id;
    }

    const j: any = await apiPost('/api/work-plan-assignment/save', {
      team_name: teamName,
      user_ids: newList.map((x: any) => x.user_id),
      default_user_id: defaultId,
    });
    if (j.ok) {
      const msg = j.copied > 0
        ? `User assigned. ${j.copied} confirmed work plan entr${j.copied === 1 ? 'y' : 'ies'} copied to daily plan.`
        : 'User assigned successfully.';
      showToast(msg);
      timers.current.push(setTimeout(reloadPage, 1400));
    } else showToast(j.error || 'Failed.', 'error');
  }

  async function removeAssign(assignId: number, _teamName: string) {
    if (!confirm('Remove this user from the assignment?')) return;
    const j: any = await apiSend('DELETE', '/api/work-plan-assignment/delete/' + assignId);
    if (j.ok) { showToast('Removed.'); timers.current.push(setTimeout(reloadPage, 600)); }
    else showToast('Failed to remove.', 'error');
  }

  async function setDefault(teamName: string, userId: number) {
    const data2: any = await apiGet('/api/work-plan-assignment');
    const existing = (data2.assignments || []).filter((a: any) => a.team_name === teamName);
    const j: any = await apiPost('/api/work-plan-assignment/save', {
      team_name: teamName,
      user_ids: existing.map((a: any) => a.user_id),
      default_user_id: userId,
    });
    if (j.ok) { showToast('Leave fallback user updated.'); timers.current.push(setTimeout(reloadPage, 600)); }
    else showToast(j.error || 'Failed.', 'error');
  }

  async function doTransfer() {
    if (!trFrom || !trTo || !trDateFrom) {
      showToast('Please fill From User, To User and Date From.', 'error'); return;
    }
    const j: any = await apiPost('/api/daily-plan/transfer', {
      from_user_id: parseInt(trFrom),
      to_user_id: parseInt(trTo),
      date_from: trDateFrom,
      date_to: trDateTo || trDateFrom,
    });
    if (j.ok) {
      setTrResult({ color: '#166534', text: j.message });
      showToast(j.message);
    } else {
      setTrResult({ color: '#991b1b', text: j.error || 'Transfer failed.' });
      showToast(j.error || 'Transfer failed.', 'error');
    }
  }

  return (
    <>
      <style>{css}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-people-fill me-2" style={{ color: '#3b82f6', fontSize: '1.3rem' }}></i>
            Work Plan Assignment
          </h1>
          <p className="page-subtitle">Map teams to users for automatic daily work plan population. Mark one user as <strong>Leave Fallback</strong> — they receive work when the assigned user is on leave.</p>
        </div>
      </div>

      <div className="row g-4">
        {/* LEFT: Team -> User assignments */}
        <div className="col-lg-7">
          <h5 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, marginBottom: '1rem', color: '#1a1f3a' }}>
            <i className="bi bi-diagram-3-fill me-2" style={{ color: '#6366f1' }}></i>Team Assignments
          </h5>

          {teams.map((team: any, i: number) => {
            const asgn: any[] = assignMap[team.name] || [];
            const key = TEAM_KEY(team.name);
            return (
              <div className="team-card" id={`tc-${i + 1}`} key={team.id ?? team.name}>
                <div className="team-card-header">
                  <div className="team-card-title">
                    <i className="bi bi-people-fill"></i>
                    {team.name}
                  </div>
                  <span style={{ fontSize: '0.72rem', opacity: 0.65 }}>{asgn.length} user(s) assigned</span>
                </div>
                <div className="team-card-body">
                  <div id={`assign-list-${key}`}>
                    {asgn.length > 0 ? (
                      asgn.map((a: any) => (
                        <div className="assign-row" id={`arow-${a.id}`} key={a.id}>
                          <div className="assign-user">
                            <i className="bi bi-person-circle me-1" style={{ color: '#9ca3af' }}></i>
                            {a.user_name}
                          </div>
                          {a.is_default ? (
                            <span className="default-badge"><i className="bi bi-shield-fill"></i> Leave Fallback</span>
                          ) : (
                            <button className="btn-sm-icon make-default" title="Set as leave fallback user"
                              onClick={() => setDefault(team.name, a.user_id)}>
                              <i className="bi bi-shield"></i> Set Fallback
                            </button>
                          )}
                          <button className="btn-sm-icon" title="Remove" onClick={() => removeAssign(a.id, team.name)}>
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="empty-assign">No users assigned yet.</div>
                    )}
                  </div>

                  {/* Add user */}
                  <div className="add-assign-form">
                    <select id={`sel-${key}`} value={selMap[key] || ''}
                      onChange={(e) => setSelMap({ ...selMap, [key]: e.target.value })}>
                      <option value="">— Select user to add —</option>
                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                    <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" id={`def-${key}`} style={{ marginRight: 4 }}
                        checked={!!defMap[key]}
                        onChange={(e) => setDefMap({ ...defMap, [key]: e.target.checked })} />
                      Leave Fallback
                    </label>
                    <button className="btn-add-assign" onClick={() => addAssign(team.name)}>
                      <i className="bi bi-plus-lg me-1"></i>Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {teams.length === 0 && (
            <div className="alert alert-warning">No teams configured. Add teams first from the Teams page.</div>
          )}
        </div>

        {/* RIGHT: Transfer panel */}
        <div className="col-lg-5">
          <h5 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, marginBottom: '1rem', color: '#1a1f3a' }}>
            <i className="bi bi-arrow-left-right me-2" style={{ color: '#e84c4c' }}></i>Transfer Daily Work Plan
          </h5>
          <div className="transfer-card">
            <p style={{ fontSize: '.83rem', color: '#6b7280', marginBottom: 16 }}>
              Move all daily plan entries from one team member to another for a given date range.
            </p>

            <div className="mb-3">
              <label className="form-label">From User</label>
              <select className="tctrl" id="tr-from" value={trFrom} onChange={(e) => setTrFrom(e.target.value)}>
                <option value="">— Select source user —</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">To User</label>
              <select className="tctrl" id="tr-to" value={trTo} onChange={(e) => setTrTo(e.target.value)}>
                <option value="">— Select destination user —</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>

            <div className="row g-2 mb-3">
              <div className="col">
                <label className="form-label">Date From</label>
                <input type="date" className="tctrl" id="tr-date-from" value={trDateFrom} onChange={(e) => setTrDateFrom(e.target.value)} />
              </div>
              <div className="col">
                <label className="form-label">Date To <span style={{ color: '#9ca3af', fontSize: '.78rem' }}>(optional)</span></label>
                <input type="date" className="tctrl" id="tr-date-to" value={trDateTo} onChange={(e) => setTrDateTo(e.target.value)} />
              </div>
            </div>

            <button className="btn-add-assign w-100" onClick={doTransfer}>
              <i className="bi bi-arrow-left-right me-1"></i>Transfer Entries
            </button>
            <div id="tr-result" style={{ marginTop: 10, fontSize: '.83rem', fontWeight: 600, color: trResult.color }}>{trResult.text}</div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast-msg toast-${toast.type}${toast.show ? ' show' : ''}`} id="toastEl">{toast.msg}</div>
    </>
  );
}
