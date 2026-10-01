'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePageData } from '@/hooks/usePageData';
import { useSession } from '@/context/Session';
import { useAction } from '@/context/Flash';

const css = `
.lm-item {
    display:flex; align-items:center; gap:12px;
    padding:10px 14px; border-radius:10px; margin-bottom:8px;
}
.lm-item.lm-leave    { background:#fee2e2; border-left:4px solid #ef4444; }
.lm-item.lm-training { background:#fef3c7; border-left:4px solid #f59e0b; }
.lm-avatar {
    width:36px; height:36px; border-radius:50%; flex-shrink:0;
    color:#fff; display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:0.9rem;
}
.lm-avatar.lm-leave    { background:#ef4444; }
.lm-avatar.lm-training { background:#f59e0b; }
.lm-status-label { font-size:0.75rem; font-weight:600; }
.lm-status-label.lm-leave    { color:#991b1b; }
.lm-status-label.lm-training { color:#92400e; }
.lm-icon-leave    { color:#ef4444; font-size:1.1rem; }
.lm-icon-training { color:#f59e0b; font-size:1.1rem; }
`;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// strftime('%A, %B %d, %Y') for a YYYY-MM-DD string
function longDate(iso: string): string {
  const [y, m, d] = (iso || '').slice(0, 10).split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]}, ${MONTHS[m - 1]} ${String(d).padStart(2, '0')}, ${y}`;
}

type QuickLink = { href: string; bg: string; color: string; icon: string; iconStyle?: React.CSSProperties; title: string; sub: string };

function QuickCard({ l }: { l: QuickLink }) {
  return (
    <div className="col-md-6 col-lg-3">
      <Link href={l.href} className="card text-decoration-none h-100">
        <div className="card-body d-flex align-items-center gap-3 p-3">
          <div style={{ width: 48, height: 48, background: l.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: l.color, flexShrink: 0 }}>
            <i className={`bi ${l.icon}`} style={l.iconStyle}></i>
          </div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, color: '#1a1f3a' }}>{l.title}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{l.sub}</div>
          </div>
          <i className="bi bi-arrow-right ms-auto" style={{ color: '#9ca3af' }}></i>
        </div>
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { data } = usePageData<{ today: string; on_leave: number; leave_today: { name: string; status: string }[] }>('/api/pages/dashboard');
  const { user } = useSession();
  const run = useAction();
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLeaveOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function onBackup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run('POST', '/api/actions/backup-excel');
  }

  if (!data) return <style>{css}</style>;

  const { today, on_leave, leave_today } = data;
  const isAdmin = user?.role === 'admin';
  const scheduleUrl = 'http://' + window.location.hostname + ':5005';

  return (
    <>
      <style>{css}</style>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{longDate(today)}</p>
        </div>
        <Link href="/daily-work-plan?openModal=1" className="btn btn-accent">
          <i className="bi bi-plus-lg me-1"></i> Add Daily Entry
        </Link>
      </div>

      {/* Stats Row */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div
            className="stat-card"
            id="leave-modal-trigger"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', cursor: 'pointer' }}
            title="View who's on leave today"
            onClick={() => setLeaveOpen(true)}
          >
            <div className="stat-icon"><i className="bi bi-calendar-x"></i></div>
            <div className="stat-value">{on_leave}</div>
            <div className="stat-label">On Leave</div>
          </div>
        </div>
      </div>

      {/* On Leave Today Modal */}
      <div
        id="leave-modal"
        style={{ display: leaveOpen ? 'flex' : 'none', position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,23,42,.5)', alignItems: 'center', justifyContent: 'center' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLeaveOpen(false);
        }}
      >
        <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>
                <i className="bi bi-calendar-x me-2"></i>On Leave Today
              </div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{longDate(today)}</div>
            </div>
            <button
              id="leave-modal-close"
              onClick={() => setLeaveOpen(false)}
              style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: '1rem', cursor: 'pointer' }}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          {/* Body */}
          <div style={{ padding: '18px 22px' }}>
            {leave_today && leave_today.length > 0 ? (
              <>
                {leave_today.map((item, i) => {
                  const cls = item.status === 'LEAVE' ? 'lm-leave' : 'lm-training';
                  return (
                    <div className={`lm-item ${cls}`} key={i}>
                      <div className={`lm-avatar ${cls}`}>{(item.name || '')[0]?.toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1a1f3a' }}>{item.name}</div>
                        <div className={`lm-status-label ${cls}`}>{item.status}</div>
                      </div>
                      {item.status === 'LEAVE' ? (
                        <i className="bi bi-calendar-x lm-icon-leave"></i>
                      ) : (
                        <i className="bi bi-mortarboard lm-icon-training"></i>
                      )}
                    </div>
                  );
                })}
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <Link href="/leave-calendar" className="btn btn-sm" style={{ background: '#1a1f3a', color: '#fff', borderRadius: 9, fontSize: '0.8rem', padding: '7px 18px' }}>
                    <i className="bi bi-calendar3 me-1"></i> View Full Calendar
                  </Link>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <i className="bi bi-check-circle" style={{ fontSize: '2.5rem', color: '#10b981', display: 'block', marginBottom: 10 }}></i>
                <div style={{ fontWeight: 700, color: '#1a1f3a', marginBottom: 4 }}>Everyone's in!</div>
                <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>No leave or training recorded for today.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backup Button */}
      <div className="mb-3 d-flex justify-content-end">
        <form onSubmit={onBackup} style={{ margin: 0 }}>
          <button
            type="submit"
            className="btn btn-sm d-flex align-items-center gap-2"
            style={{ background: '#fff', color: '#059669', borderRadius: 10, fontWeight: 600, border: '1.5px solid #a7f3d0', padding: '8px 18px', boxShadow: '0 2px 6px rgba(16,185,129,.12)' }}
          >
            <i className="bi bi-archive-fill"></i> Backup Excel Files
          </button>
        </form>
      </div>

      {/* Quick Links */}
      <div className="row g-3">
        <QuickCard l={{ href: '/daily-work-plan', bg: '#eff6ff', color: '#3b82f6', icon: 'bi-person-fill-check', title: 'Daily Work Plan', sub: 'Track member activities' }} />
        <QuickCard l={{ href: '/work-plan', bg: '#dcffe6', color: '#10b981', icon: 'bi-calendar3', title: 'Work Plan', sub: 'Team project schedule' }} />
        <QuickCard l={{ href: '/master-submission', bg: '#faebeb', color: '#10b981', icon: 'bi-calendar2-check', iconStyle: { color: '#511515' }, title: 'Package Submission', sub: 'Track all project deliverables' }} />
        <QuickCard l={{ href: '/leave-calendar', bg: '#fee2e2', color: '#ef4444', icon: 'bi-calendar2-x', title: 'Leave Calendar', sub: 'Team leave & training view' }} />
        {isAdmin && (
          <QuickCard l={{ href: '/users', bg: '#fef3c7', color: '#f59e0b', icon: 'bi-people', title: 'Users', sub: 'Manage team members' }} />
        )}
        <QuickCard l={{ href: '/master-submission/log', bg: '#ddfeff', color: '#f59e0b', icon: 'bi-person-lines-fill', iconStyle: { color: '#297d80' }, title: 'Submission Log', sub: 'Manage submission logs' }} />
        <QuickCard l={{ href: '/ownership-log', bg: '#fff7ed', color: '#c2410c', icon: 'bi-clipboard2-data-fill', title: 'Ownership Log', sub: 'Project ownership & QC calendar' }} />
        <div className="col-md-6 col-lg-3">
          <a href={scheduleUrl} target="_blank" className="card text-decoration-none h-100">
            <div className="card-body d-flex align-items-center gap-3 p-3">
              <div style={{ width: 48, height: 48, background: '#e0f2fe', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#0284c7', flexShrink: 0 }}>
                <i className="bi bi-calendar2-range"></i>
              </div>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, color: '#1a1f3a' }}>Schedule Tracker</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Open in new tab</div>
              </div>
              <i className="bi bi-box-arrow-up-right ms-auto" style={{ color: '#9ca3af' }}></i>
            </div>
          </a>
        </div>
      </div>
    </>
  );
}
