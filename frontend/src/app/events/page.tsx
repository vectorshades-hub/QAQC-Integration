'use client';
import { useEffect, useRef, useState } from 'react';
import { usePageData } from '@/hooks/usePageData';
import { useAction, useFlash } from '@/context/Flash';
import { apiGet, apiPost } from '@/lib/api';

const css = `
.ev-tab-btn {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    padding: 7px 20px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
}
.ev-tab-btn.active {
    background: #1a1f3a;
    border-color: #1a1f3a;
    color: #fff;
}
.ev-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    transition: box-shadow 0.2s;
}
.ev-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.ev-icon-wrap {
    width: 44px; height: 44px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.3rem;
    flex-shrink: 0;
}
.ev-badge-date {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 20px;
    background: #eff6ff;
    color: #1e40af;
}
.ev-badge-today {
    background: #fef3c7;
    color: #92400e;
}
.ev-badge-past {
    background: #f3f4f6;
    color: #6b7280;
}
.bday-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1rem;
    color: #fff;
    flex-shrink: 0;
}
.month-chip {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    background: #f3f4f6;
    color: #374151;
    margin-bottom: 0.6rem;
}
.empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #9ca3af;
}
.empty-state i { font-size: 3rem; display: block; margin-bottom: 0.75rem; }
.modal-overlay {
    display: none; position: fixed; inset: 0; z-index: 700;
    background: rgba(15,23,42,.5);
    align-items: center; justify-content: center;
}
.modal-overlay.show { display: flex; }
.modal-box {
    background: #fff; border-radius: 16px;
    width: 90%; max-width: 480px;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0,0,0,.2);
    max-height: 90vh; overflow-y: auto;
}
.modal-header {
    padding: 18px 22px;
    display: flex; align-items: center; justify-content: space-between;
}
.modal-body { padding: 20px 22px; }
.modal-footer { padding: 12px 22px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; justify-content: flex-end; }
.close-btn {
    background: rgba(255,255,255,.2); border: none; color: #fff;
    border-radius: 8px; padding: 6px 10px; font-size: 1rem; cursor: pointer;
}
`;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLORS = ['#e84c4c', '#f5a623', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b'];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function formatDate(s: string) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const iconBtnBase = { border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: '0.8rem' } as const;
const cancelBtnStyle = { border: '1px solid #e5e7eb', color: '#6b7280', borderRadius: 8, padding: '7px 16px' } as const;

export default function EventsPage() {
  const { data } = usePageData<any>('/api/pages/events');
  const IS_ADMIN = !!data?.is_admin;
  const run = useAction();
  const { tick } = useFlash();

  const [tab, setTab] = useState<'bday' | 'ann'>('bday');
  const [annItems, setAnnItems] = useState<any[] | null>(null);
  const [annFailed, setAnnFailed] = useState(false);
  const [bdayItems, setBdayItems] = useState<any[] | null>(null);
  const [bdayFailed, setBdayFailed] = useState(false);
  const annLoaded = useRef(false);
  const bdayLoaded = useRef(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [edit, setEdit] = useState({ id: 0, title: '', event_date: '', description: '', is_active: false });

  const [bdayEditOpen, setBdayEditOpen] = useState(false);
  const [bdayEditUid, setBdayEditUid] = useState<number | null>(null);
  const [bdayEditName, setBdayEditName] = useState('');
  const [bdayEditValue, setBdayEditValue] = useState('');
  const [bdayEditSaving, setBdayEditSaving] = useState(false);

  // Computed on the client after mount only (fetch results render after mount)
  const TODAY = new Date().toISOString().slice(0, 10);

  const loadAnnouncements = async () => {
    annLoaded.current = true;
    try {
      const d = await apiGet('/api/events');
      setAnnItems(d.items || []);
    } catch {
      setAnnFailed(true);
    }
  };
  const loadBirthdays = async () => {
    bdayLoaded.current = true;
    try {
      const d = await apiGet('/api/events/birthdays');
      setBdayItems(d.items || []);
    } catch {
      setBdayFailed(true);
    }
  };

  // Initial load (Birthdays tab is default); an action redirecting here re-renders the page like a full reload did.
  useEffect(() => {
    annLoaded.current = false;
    bdayLoaded.current = false;
    setAnnItems(null);
    setAnnFailed(false);
    setBdayItems(null);
    setBdayFailed(false);
    setTab('bday');
    setAddOpen(false);
    setEditOpen(false);
    setFormKey((k) => k + 1);
    loadBirthdays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const switchTab = (t: 'bday' | 'ann') => {
    setTab(t);
    if (t === 'bday' && !bdayLoaded.current) loadBirthdays();
    if (t === 'ann' && !annLoaded.current) loadAnnouncements();
  };

  const openEditModal = (ev: any) => {
    setEdit({
      id: ev.id,
      title: ev.title,
      event_date: ev.event_date,
      description: ev.description || '',
      is_active: !!ev.is_active,
    });
    setEditOpen(true);
  };

  const confirmDelete = async (directId?: number) => {
    const id = directId !== undefined ? directId : edit.id;
    if (!confirm('Delete this announcement?')) return;
    if (directId !== undefined) setEditOpen(false);
    await run('POST', `/api/actions/events/delete/${id}`);
  };

  const openBdayEdit = (uid: number, name: string, currentBday: string) => {
    setBdayEditUid(uid);
    setBdayEditName(name);
    setBdayEditValue(currentBday ? currentBday.slice(0, 10) : '');
    setBdayEditOpen(true);
  };
  const saveBday = async () => {
    const val = bdayEditValue || null;
    setBdayEditSaving(true);
    try {
      const d = await apiPost(`/api/users/${bdayEditUid}/birthday`, { birthday: val });
      if (d.ok) {
        setBdayEditOpen(false);
        bdayLoaded.current = false;
        if (tab === 'bday') loadBirthdays();
      }
    } finally {
      setBdayEditSaving(false);
    }
  };

  // ── Announcements render ──
  const renderAnnouncements = () => {
    const items = annItems || [];
    return items.map((ev: any) => {
      const isToday = ev.event_date === TODAY;
      const isPast = ev.event_date < TODAY;
      const badgeCls = isToday ? 'ev-badge-today' : isPast ? 'ev-badge-past' : '';
      const iconBg = isToday ? '#fef3c7' : isPast ? '#f3f4f6' : '#eff6ff';
      const iconCol = isToday ? '#f59e0b' : isPast ? '#9ca3af' : '#3b82f6';
      return (
        <div className="ev-card" key={ev.id} style={!ev.is_active ? { opacity: 0.6 } : undefined}>
          <div className="ev-icon-wrap" style={{ background: iconBg, color: iconCol }}>
            <i className="bi bi-megaphone-fill"></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1a1f3a' }}>
                {ev.title}
                {!ev.is_active && <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: 6 }}>(inactive)</span>}
              </div>
              <span className={`ev-badge-date ${badgeCls}`}>
                {formatDate(ev.event_date)}
                {isToday ? ' · Today' : ''}
              </span>
            </div>
            {ev.description && (
              <div style={{ fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'pre-line' }}>{ev.description}</div>
            )}
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4 }}>Added by {ev.created_by || '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {IS_ADMIN && (
              <button
                className="btn btn-sm"
                onClick={() => openEditModal(ev)}
                style={{ ...iconBtnBase, background: '#f3f4f6', color: '#374151' }}
                title="Edit"
              >
                <i className="bi bi-pencil"></i>
              </button>
            )}
            {IS_ADMIN && (
              <button
                className="btn btn-sm"
                onClick={() => confirmDelete(ev.id)}
                style={{ ...iconBtnBase, background: '#fee2e2', color: '#e84c4c' }}
                title="Delete"
              >
                <i className="bi bi-trash"></i>
              </button>
            )}
          </div>
        </div>
      );
    });
  };

  // ── Birthdays render ──
  const renderBirthdays = (): { nodes: any[]; show: boolean } => {
    const items = bdayItems || [];
    const withBday = items.filter((u: any) => u.birthday);
    if (!withBday.length && !IS_ADMIN) return { nodes: [], show: false };

    const byMonth: Record<number, any[]> = {};
    const today = new Date();
    const todayMon = today.getMonth() + 1;
    const todayDay = today.getDate();

    withBday.forEach((u: any) => {
      const d = new Date(u.birthday);
      const mon = d.getUTCMonth() + 1;
      if (!byMonth[mon]) byMonth[mon] = [];
      byMonth[mon].push({ ...u, mon, day: d.getUTCDate() });
    });

    const months = Object.keys(byMonth)
      .map(Number)
      .sort((a, b) => {
        const ra = (a - todayMon + 12) % 12;
        const rb = (b - todayMon + 12) % 12;
        return ra - rb;
      });

    const nodes: any[] = [];
    months.forEach((mon) => {
      const members = byMonth[mon].sort((a, b) => a.day - b.day);
      nodes.push(
        <div className="month-chip" key={`m${mon}`}>
          <i className="bi bi-calendar3 me-1"></i>
          {MONTH_NAMES[mon - 1]}
        </div>
      );
      members.forEach((u) => {
        const isToday = u.mon === todayMon && u.day === todayDay;
        const initials = u.full_name
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        const col = avatarColor(u.full_name);
        const dayStr = String(u.day).padStart(2, '0');
        const monStr = MONTH_NAMES[u.mon - 1];
        nodes.push(
          <div
            className="ev-card"
            key={`u${u.id}`}
            style={isToday ? { borderColor: '#fde68a', background: '#fffbeb' } : undefined}
          >
            <div className="bday-avatar" style={{ background: col }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1a1f3a' }}>{u.full_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                {isToday ? (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#92400e',
                      background: '#fef3c7',
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}
                  >
                    🎂 Today!
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    {monStr} {dayStr}
                  </span>
                )}
                {u.team ? <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{u.team}</span> : null}
              </div>
            </div>
            {IS_ADMIN && (
              <button
                className="btn btn-sm"
                onClick={() => openBdayEdit(u.id, u.full_name, u.birthday)}
                style={{ ...iconBtnBase, background: '#f3f4f6', color: '#374151' }}
              >
                <i className="bi bi-pencil"></i>
              </button>
            )}
          </div>
        );
      });
    });

    if (IS_ADMIN) {
      const noBday = items.filter((u: any) => !u.birthday);
      if (noBday.length) {
        nodes.push(
          <div className="month-chip" key="nobday" style={{ background: '#fee2e2', color: '#991b1b' }}>
            No Birthday Set
          </div>
        );
        noBday.forEach((u: any) => {
          const initials = u.full_name
            .split(' ')
            .map((w: string) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const col = avatarColor(u.full_name);
          nodes.push(
            <div className="ev-card" key={`nb${u.id}`} style={{ opacity: 0.65 }}>
              <div className="bday-avatar" style={{ background: col }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1a1f3a' }}>{u.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>Birthday not set</div>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => openBdayEdit(u.id, u.full_name, '')}
                style={{ ...iconBtnBase, background: '#fee2e2', color: '#e84c4c' }}
              >
                <i className="bi bi-plus-lg me-1"></i>Set
              </button>
            </div>
          );
        });
      }
    }
    return { nodes, show: nodes.length > 0 };
  };

  const ann = annItems ? renderAnnouncements() : [];
  const bday = bdayItems ? renderBirthdays() : { nodes: [], show: false };

  return (
    <>
      <style>{css}</style>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-calendar-heart me-2" style={{ color: '#e84c4c' }}></i>Events &amp; Activities
          </h1>
          <p className="page-subtitle">Team birthdays and announcements</p>
        </div>
        {IS_ADMIN && (
          <button className="btn btn-accent btn-sm" onClick={() => setAddOpen(true)}>
            <i className="bi bi-plus-lg me-1"></i> Add Announcement
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="d-flex gap-2 mb-4">
        <button className={`ev-tab-btn${tab === 'bday' ? ' active' : ''}`} id="tab-bday" onClick={() => switchTab('bday')}>
          <i className="bi bi-balloon-heart me-1"></i> Birthdays
        </button>
        <button className={`ev-tab-btn${tab === 'ann' ? ' active' : ''}`} id="tab-ann" onClick={() => switchTab('ann')}>
          <i className="bi bi-megaphone me-1"></i> Announcements
        </button>
      </div>

      {/* Announcements Panel */}
      <div id="panel-ann" style={{ display: tab === 'ann' ? '' : 'none' }}>
        {annItems === null && (
          <div id="ann-loading" className="empty-state">
            {annFailed ? (
              <>
                <i className="bi bi-exclamation-triangle" style={{ color: '#fbbf24' }}></i>
                <div>Failed to load.</div>
              </>
            ) : (
              <>
                <i className="bi bi-hourglass-split" style={{ color: '#d1d5db' }}></i>
                <div>Loading announcements…</div>
              </>
            )}
          </div>
        )}
        {annItems !== null && annItems.length > 0 && <div id="ann-list">{ann}</div>}
        {annItems !== null && annItems.length === 0 && (
          <div id="ann-empty" className="empty-state">
            <i className="bi bi-megaphone" style={{ color: '#d1d5db' }}></i>
            <div style={{ fontWeight: 600, color: '#6b7280' }}>No announcements yet</div>
            {IS_ADMIN && (
              <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                Click <strong>Add Announcement</strong> to create one.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Birthdays Panel */}
      <div id="panel-bday" style={{ display: tab === 'bday' ? '' : 'none' }}>
        {bdayItems === null && (
          <div id="bday-loading" className="empty-state">
            {bdayFailed ? (
              <>
                <i className="bi bi-exclamation-triangle" style={{ color: '#fbbf24' }}></i>
                <div>Failed to load.</div>
              </>
            ) : (
              <>
                <i className="bi bi-hourglass-split" style={{ color: '#d1d5db' }}></i>
                <div>Loading birthdays…</div>
              </>
            )}
          </div>
        )}
        {bdayItems !== null && bday.show && <div id="bday-list">{bday.nodes}</div>}
        {bdayItems !== null && !bday.show && (
          <div id="bday-empty" className="empty-state">
            <i className="bi bi-balloon-heart" style={{ color: '#d1d5db' }}></i>
            <div style={{ fontWeight: 600, color: '#6b7280' }}>No birthdays set</div>
            {IS_ADMIN && <div style={{ fontSize: '0.82rem', marginTop: 4 }}>Edit users to add their birthday dates.</div>}
          </div>
        )}
      </div>

      {IS_ADMIN && (
        <>
          {/* Add Announcement Modal */}
          <div
            className={`modal-overlay${addOpen ? ' show' : ''}`}
            id="addModal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAddOpen(false);
            }}
          >
            <div className="modal-box">
              <div className="modal-header" style={{ background: 'linear-gradient(135deg,#1a1f3a,#2d3561)' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                  <i className="bi bi-megaphone me-2"></i>New Announcement
                </div>
                <button className="close-btn" onClick={() => setAddOpen(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <form
                key={formKey}
                method="POST"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run('POST', '/api/actions/events/add', new FormData(e.currentTarget));
                }}
              >
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">
                      Title <span style={{ color: '#e84c4c' }}>*</span>
                    </label>
                    <input type="text" name="title" className="form-control" required placeholder="e.g. Team Outing – December" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      Date <span style={{ color: '#e84c4c' }}>*</span>
                    </label>
                    <input type="date" name="event_date" className="form-control" required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea name="description" className="form-control" rows={3} placeholder="Details, venue, time…"></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm" style={cancelBtnStyle} onClick={() => setAddOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-accent btn-sm">
                    <i className="bi bi-plus-lg me-1"></i>Add
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Edit Announcement Modal */}
          <div
            className={`modal-overlay${editOpen ? ' show' : ''}`}
            id="editModal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditOpen(false);
            }}
          >
            <div className="modal-box">
              <div className="modal-header" style={{ background: 'linear-gradient(135deg,#1a1f3a,#2d3561)' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                  <i className="bi bi-pencil me-2"></i>Edit Announcement
                </div>
                <button className="close-btn" onClick={() => setEditOpen(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <form
                method="POST"
                id="editForm"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run('POST', `/api/actions/events/edit/${edit.id}`, new FormData(e.currentTarget));
                }}
              >
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">
                      Title <span style={{ color: '#e84c4c' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      id="editTitle"
                      className="form-control"
                      required
                      value={edit.title}
                      onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      Date <span style={{ color: '#e84c4c' }}>*</span>
                    </label>
                    <input
                      type="date"
                      name="event_date"
                      id="editDate"
                      className="form-control"
                      required
                      value={edit.event_date}
                      onChange={(e) => setEdit({ ...edit, event_date: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      id="editDesc"
                      className="form-control"
                      rows={3}
                      value={edit.description}
                      onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                    ></textarea>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      id="editActive"
                      style={{ width: 16, height: 16 }}
                      checked={edit.is_active}
                      onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
                    />
                    <label htmlFor="editActive" style={{ fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
                      Active (show in popup)
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    id="editDeleteBtn"
                    className="btn btn-sm"
                    style={{ border: '1px solid #fee2e2', color: '#e84c4c', borderRadius: 8, padding: '7px 16px', marginRight: 'auto' }}
                    onClick={() => confirmDelete()}
                  >
                    <i className="bi bi-trash me-1"></i>Delete
                  </button>
                  <button type="button" className="btn btn-sm" style={cancelBtnStyle} onClick={() => setEditOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-accent btn-sm">
                    <i className="bi bi-check-lg me-1"></i>Save
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Birthday Edit Modal */}
          <div
            className={`modal-overlay${bdayEditOpen ? ' show' : ''}`}
            id="bdayEditModal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setBdayEditOpen(false);
            }}
          >
            <div className="modal-box" style={{ maxWidth: 380 }}>
              <div className="modal-header" style={{ background: 'linear-gradient(135deg,#e84c4c,#c93a3a)' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                  <i className="bi bi-balloon-heart me-2"></i>Set Birthday
                </div>
                <button className="close-btn" onClick={() => setBdayEditOpen(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '1rem' }}>
                  Setting birthday for <strong id="bdayEditName">{bdayEditName}</strong>
                </p>
                <label className="form-label">Birthday Date</label>
                <input
                  type="date"
                  id="bdayEditInput"
                  className="form-control"
                  value={bdayEditValue}
                  onChange={(e) => setBdayEditValue(e.target.value)}
                />
                <small style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                  Only month &amp; day are used for recurring yearly wishes.
                </small>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-sm" style={cancelBtnStyle} onClick={() => setBdayEditOpen(false)}>
                  Cancel
                </button>
                <button type="button" id="bdayEditSaveBtn" className="btn btn-accent btn-sm" disabled={bdayEditSaving} onClick={saveBday}>
                  <i className="bi bi-check-lg me-1"></i>Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
