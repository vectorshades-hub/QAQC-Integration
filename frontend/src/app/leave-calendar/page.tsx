'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useToastApi } from '@/context/Toast';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePageData } from '@/hooks/usePageData';
import { useAction } from '@/context/Flash';
import { useSession } from '@/context/Session';
import { qs } from '@/lib/api';

const css = `
.lc-wrap { max-width: 1200px; margin: 0 auto; }

/* ── Nav bar ── */
.lc-nav {
    display: flex; align-items: center; justify-content: space-between;
    background: #fff; border: 1px solid #e5e7eb;
    border-radius: 12px; padding: 14px 22px; margin-bottom: 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.lc-month-title {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: 1.4rem; color: #1a1f3a;
}
.lc-nav-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 16px; border-radius: 8px; font-size: 0.85rem;
    font-weight: 600; text-decoration: none;
    border: 1.5px solid #e5e7eb; background: #f9fafb;
    color: #374151; transition: all .15s;
}
.lc-nav-btn:hover { background: #1a1f3a; color: #fff; border-color: #1a1f3a; }

/* ── Legend ── */
.lc-legend { display: flex; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
.lc-legend-item { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; font-weight: 500; color: #374151; }
.lc-dot { width: 13px; height: 13px; border-radius: 4px; flex-shrink: 0; }
.lc-legend-hint { margin-left: auto; font-size: 0.78rem; color: #9ca3af; display: flex; align-items: center; gap: 5px; }

/* ── Calendar grid ── */
.lc-grid {
    background: #fff; border: 1px solid #e5e7eb;
    border-radius: 12px; overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.lc-weekdays {
    display: grid; grid-template-columns: repeat(7, 1fr);
    background: #1a1f3a;
}
.lc-weekday {
    padding: 11px 0; text-align: center;
    font-size: 0.72rem; font-weight: 700; letter-spacing: .8px;
    text-transform: uppercase; color: rgba(255,255,255,.75);
}
.lc-weekday.weekend { color: #e84c4c; }

.lc-body { display: grid; grid-template-columns: repeat(7, 1fr); }
.lc-cell {
    min-height: 108px; padding: 7px 7px 5px;
    border-right: 1px solid #f0f2f5;
    border-bottom: 1px solid #f0f2f5;
    position: relative; cursor: pointer;
    transition: background .12s;
}
.lc-cell:nth-child(7n) { border-right: none; }
.lc-cell:hover:not(.other-month) { background: #f0f9ff !important; }
.lc-cell.other-month { background: #fafafa; cursor: default; }
.lc-cell.today-cell  { background: #eff6ff; }
.lc-cell.weekend-cell { background: #fef9f9; }

.lc-day-num {
    font-size: 0.8rem; font-weight: 700; color: #374151;
    width: 24px; height: 24px; display: flex; align-items: center;
    justify-content: center; border-radius: 50%;
    margin-bottom: 3px;
}
.lc-cell.today-cell .lc-day-num { background: #1a1f3a; color: #fff; }
.lc-cell.other-month .lc-day-num { color: #d1d5db; }

.lc-add-btn {
    position: absolute; bottom: 5px; right: 5px;
    width: 20px; height: 20px; border-radius: 50%;
    background: #e0f2fe; color: #0369a1;
    display: none; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; line-height: 1;
    border: none; cursor: pointer; transition: all .15s;
}
.lc-cell:hover:not(.other-month) .lc-add-btn { display: flex; }
.lc-add-btn:hover { background: #0369a1; color: #fff; }

/* ── Chips ── */
.lc-chips { display: flex; flex-direction: column; gap: 2px; }
.lc-chip {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 6px; border-radius: 5px;
    font-size: 0.68rem; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    position: relative;
}
.lc-chip.leave     { background: #fee2e2; color: #991b1b; border-left: 3px solid #ef4444; }
.lc-chip.training  { background: #fef3c7; color: #92400e; border-left: 3px solid #f59e0b; }
.lc-chip.half-day  { background: #ede9fe; color: #5b21b6; border-left: 3px solid #8b5cf6; }
.lc-chip i { font-size: 0.65rem; flex-shrink: 0; }
.chip-del {
    margin-left: auto; background: none; border: none;
    color: inherit; opacity: 0.5; cursor: pointer; padding: 0 1px;
    font-size: 11px; line-height: 1; flex-shrink: 0;
}
.chip-del:hover { opacity: 1; }
.lc-more {
    font-size: 0.65rem; color: #6b7280; font-weight: 600;
    padding: 1px 5px; border-radius: 4px; background: #f3f4f6;
    margin-top: 1px; display: inline-block; cursor: pointer;
}
.lc-more:hover { background: #e5e7eb; }

/* ── Summary card ── */
.lc-summary-card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
    margin-top: 20px; overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.lc-summary-hdr {
    background: #1a1f3a; color: #fff; padding: 13px 20px;
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.95rem; display: flex; align-items: center; gap: 8px;
}
.lc-sum-row {
    display: flex; align-items: center; gap: 12px;
    padding: 9px 18px; border-bottom: 1px solid #f0f2f5;
    font-size: 0.83rem;
}
.lc-sum-row:last-child { border-bottom: none; }
.lc-sum-date { min-width: 90px; font-weight: 700; color: #1a1f3a; }
.lc-sum-chips { display: flex; flex-wrap: wrap; gap: 5px; flex: 1; }
.lc-sum-count { font-size: 0.75rem; color: #6b7280; min-width: 70px; text-align: right; }

/* ── Modal ── */
.lc-modal-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(15,23,42,.45); z-index: 500;
    align-items: center; justify-content: center;
}
.lc-modal-overlay.open { display: flex; }
.lc-modal {
    background: #fff; border-radius: 14px;
    box-shadow: 0 20px 40px rgba(0,0,0,.18);
    width: 90%; max-width: 400px; overflow: hidden;
}
.lc-modal-hdr {
    background: #1a1f3a; color: #fff;
    padding: 16px 20px; font-family: 'Syne', sans-serif;
    font-weight: 700; font-size: 1rem;
    display: flex; align-items: center; justify-content: space-between;
}
.lc-modal-close {
    background: none; border: none; color: rgba(255,255,255,.7);
    font-size: 1.2rem; cursor: pointer; line-height: 1;
}
.lc-modal-close:hover { color: #fff; }
.lc-modal-body { padding: 20px; }
.lc-modal-date {
    font-size: 0.82rem; font-weight: 600; color: #6b7280;
    margin-bottom: 14px; display: flex; align-items: center; gap: 6px;
}
.lc-status-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.lc-tab {
    flex: 1; padding: 8px 0; text-align: center; border-radius: 8px;
    font-size: 0.82rem; font-weight: 600; cursor: pointer;
    border: 2px solid #e5e7eb; background: #f9fafb; color: #374151;
    transition: all .15s;
}
.lc-tab.active-leave     { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
.lc-tab.active-training  { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
.lc-tab.active-half-day  { background: #ede9fe; border-color: #8b5cf6; color: #5b21b6; }
.lc-user-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 7px; max-height: 260px; overflow-y: auto;
}
.lc-user-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 10px; border-radius: 8px;
    border: 1.5px solid #e5e7eb; background: #f9fafb;
    font-size: 0.8rem; font-weight: 500; color: #374151;
    cursor: pointer; transition: all .15s; text-align: left;
}
.lc-user-btn:hover { border-color: #1a1f3a; background: #f0f4ff; color: #1a1f3a; }
.lc-user-btn.on-leave     { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
.lc-user-btn.on-training  { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
.lc-user-btn.on-half-day  { background: #ede9fe; border-color: #8b5cf6; color: #5b21b6; }

/* ── Session sub-tabs (Morning / Evening) ── */
.lc-session-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.lc-session-btn {
    flex: 1; padding: 6px 0; text-align: center; border-radius: 8px;
    font-size: 0.8rem; font-weight: 600; cursor: pointer;
    border: 2px solid #e5e7eb; background: #f9fafb; color: #374151;
    transition: all .15s;
}
.lc-session-btn.active { background: #ede9fe; border-color: #8b5cf6; color: #5b21b6; }
.lc-user-avatar {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    background: #1a1f3a; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 700;
}
.lc-user-btn.on-leave .lc-user-avatar     { background: #ef4444; }
.lc-user-btn.on-training .lc-user-avatar  { background: #f59e0b; }
.lc-user-btn.on-half-day .lc-user-avatar  { background: #8b5cf6; }

/* ── Locked month ── */
.lc-cell.locked-cell { cursor: not-allowed; }
.lc-cell.locked-cell:hover:not(.other-month) { background: inherit !important; }
.lc-cell.locked-cell.today-cell:hover { background: #eff6ff !important; }
.lc-cell.locked-cell.weekend-cell:hover { background: #fef9f9 !important; }
.lc-lock-icon {
    position: absolute; top: 5px; right: 5px;
    font-size: 0.65rem; color: #d1d5db; pointer-events: none;
}
.lc-lock-banner {
    display: flex; align-items: center; gap: 8px;
    background: #fffbeb; border: 1px solid #fcd34d;
    border-radius: 8px; padding: 9px 14px;
    font-size: 0.82rem; font-weight: 600; color: #92400e;
    margin-bottom: 14px;
}
`;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function chipClass(status: string) {
  return status === 'LEAVE' ? 'leave' : status === 'HALF_DAY_AM' || status === 'HALF_DAY_PM' ? 'half-day' : 'training';
}

function LeaveCalendarInner() {
  const sp = useSearchParams();
  const year = sp.get('year');
  const month = sp.get('month');
  const { data, loading } = usePageData<any>('/api/pages/leave-calendar' + qs({ year, month }));
  const { user } = useSession();
  const run = useAction();

  const [modalOpen, setModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [currentStatus, setCurrentStatus] = useState('LEAVE');
  const [currentSession, setCurrentSession] = useState('AM');
  const toastApi = useToastApi();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);


  const isAdmin: boolean = !!data?.is_admin;
  const lockBefore: string = data?.lock_before;
  const isDateLocked = (d: string) => !isAdmin && !!lockBefore && d < lockBefore;

  const showLockToast = useCallback(() => toastApi.warning('This period is locked. Contact administrator to update.', 'Period locked'), [toastApi]);

  const openModal = (dateStr: string) => {
    if (isDateLocked(dateStr)) {
      showLockToast();
      return;
    }
    setCurrentDate(dateStr);
    setCurrentSession('AM');
    setCurrentStatus('LEAVE');
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  if (loading || !data) {
    return (
      <>
        <style>{css}</style>
      </>
    );
  }

  const leaveData: Record<string, Record<string, { name: string; status: string }>> = data.leave_data || {};
  const allUsers: { id: number; full_name: string }[] = data.all_users || [];
  const monthNum: number = data.month;
  const today: string = data.today;
  const monthName: string = data.month_name;

  const getFinalStatus = () =>
    currentStatus === 'HALF_DAY' ? (currentSession === 'AM' ? 'HALF_DAY_AM' : 'HALF_DAY_PM') : currentStatus;

  const submitLeave = async (userId: string, isRemove: boolean) => {
    const fd = new FormData();
    fd.append('plan_date', currentDate);
    fd.append('user_id', userId);
    if (isRemove) {
      await run('POST', '/api/actions/leave-calendar/clear', fd);
    } else {
      fd.append('status', getFinalStatus());
      await run('POST', '/api/actions/leave-calendar/set', fd);
    }
    setModalOpen(false);
  };

  const hasLeaves = Object.values(leaveData).some((u) => u && Object.keys(u).length > 0);
  const curUid = user ? String(user.user_id) : '';
  const curRole = user?.role;
  const myCount = data.leave_counts ? data.leave_counts[curUid] : undefined;

  const finalSt = getFinalStatus();
  const dayLeave = leaveData[currentDate] || {};

  return (
    <>
      <style>{css}</style>
      <div className="lc-wrap">
        {/* Nav */}
        <div className="lc-nav">
          <Link href={`/leave-calendar?year=${data.prev_year}&month=${data.prev_month}`} className="lc-nav-btn">
            <i className="bi bi-chevron-left"></i> Prev
          </Link>
          <div className="lc-month-title">
            {monthName} {data.year}
          </div>
          <Link href={`/leave-calendar?year=${data.next_year}&month=${data.next_month}`} className="lc-nav-btn">
            Next <i className="bi bi-chevron-right"></i>
          </Link>
        </div>

        {/* Legend */}
        <div className="lc-legend">
          <div className="lc-legend-item">
            <div className="lc-dot" style={{ background: '#ef4444' }}></div> Full Day
          </div>
          <div className="lc-legend-item">
            <div className="lc-dot" style={{ background: '#f59e0b' }}></div> Training
          </div>
          <div className="lc-legend-item">
            <div className="lc-dot" style={{ background: '#8b5cf6' }}></div> Half Day
          </div>
          <div className="lc-legend-item">
            <div className="lc-dot" style={{ background: '#eff6ff', border: '1.5px solid #3b82f6' }}></div> Today
          </div>
          <div className="lc-legend-hint">
            <i className="bi bi-info-circle"></i> Click any day to add or remove leave
          </div>
        </div>

        {data.viewing_locked_month && (
          <div className="lc-lock-banner">
            <i className="bi bi-lock-fill"></i>
            This month is locked for editing. Contact the administrator to make changes.
          </div>
        )}

        {/* Calendar */}
        <div className="lc-grid">
          <div className="lc-weekdays">
            {WEEKDAYS.map((d) => (
              <div key={d} className={`lc-weekday ${d === 'Sat' || d === 'Sun' ? 'weekend' : ''}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="lc-body">
            {(data.weeks as string[][]).map((week) =>
              week.map((ds, col) => {
                const dayMonth = parseInt(ds.slice(5, 7), 10);
                const dayNum = parseInt(ds.slice(8, 10), 10);
                const isOther = dayMonth !== monthNum;
                const isWeekend = col >= 5;
                const dayLeaves = leaveData[ds] || {};
                const isLocked = !isAdmin && !isOther && ds < lockBefore;
                const isToday = ds === today;
                const cls = [
                  'lc-cell',
                  isToday ? 'today-cell' : '',
                  isOther ? 'other-month' : '',
                  isWeekend && !isToday ? 'weekend-cell' : '',
                  isLocked ? 'locked-cell' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const entries = Object.entries(dayLeaves);
                return (
                  <div
                    key={ds}
                    className={cls}
                    data-date={!isOther ? ds : undefined}
                    onClick={(e) => {
                      const t = e.target as HTMLElement;
                      if (t.closest('.lc-chip') || t.closest('form') || t.closest('.lc-add-btn')) return;
                      if (isOther) return;
                      if (isDateLocked(ds)) {
                        showLockToast();
                        return;
                      }
                      openModal(ds);
                    }}
                  >
                    <div className="lc-day-num">{dayNum}</div>
                    {isLocked && <i className="bi bi-lock-fill lc-lock-icon"></i>}
                    {entries.length > 0 && !isOther && (
                      <div className="lc-chips">
                        {entries.slice(0, 3).map(([uid, info]) => (
                          <div
                            key={uid}
                            className={`lc-chip ${chipClass(info.status)}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <i className="bi bi-person-fill"></i>
                            {info.name.split(' ')[0]}
                            {info.status === 'HALF_DAY_AM' ? (
                              <>
                                {' '}
                                <small>( First Half )</small>
                              </>
                            ) : info.status === 'HALF_DAY_PM' ? (
                              <>
                                {' '}
                                <small>( Second Half )</small>
                              </>
                            ) : null}
                            {!isLocked && (
                              <form
                                method="POST"
                                style={{ display: 'inline', margin: 0 }}
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!confirm(`Remove ${info.name} leave on ${ds}?`)) return;
                                  await run('POST', '/api/actions/leave-calendar/clear', new FormData(e.currentTarget));
                                }}
                              >
                                <input type="hidden" name="plan_date" value={ds} />
                                <input type="hidden" name="user_id" value={uid} />
                                <button type="submit" className="chip-del" title="Remove">
                                  <i className="bi bi-x"></i>
                                </button>
                              </form>
                            )}
                          </div>
                        ))}
                        {entries.length > 3 && <span className="lc-more">+{entries.length - 3} more</span>}
                      </div>
                    )}
                    {!isOther && !isLocked && (
                      <button
                        className="lc-add-btn"
                        data-date={ds}
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(ds);
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Monthly summary */}
        {hasLeaves ? (
          <div className="lc-summary-card">
            <div className="lc-summary-hdr">
              <i className="bi bi-list-ul"></i> {monthName} Leave Summary
            </div>
            {Object.keys(leaveData)
              .sort()
              .map((ds) => {
                const users = leaveData[ds];
                const list = Object.entries(users || {});
                if (!list.length) return null;
                return (
                  <div className="lc-sum-row" key={ds}>
                    <div className="lc-sum-date">
                      {ds.slice(8)} {monthName.slice(0, 3)}
                    </div>
                    <div className="lc-sum-chips">
                      {list.map(([uid, info]) => (
                        <span key={uid} className={`lc-chip ${chipClass(info.status)}`} style={{ flexShrink: 0 }}>
                          <i className="bi bi-person-fill"></i> {info.name}
                          {info.status === 'HALF_DAY_AM' ? ' (First Half)' : info.status === 'HALF_DAY_PM' ? ' (Second Half)' : ''}
                        </span>
                      ))}
                    </div>
                    <div className="lc-sum-count">
                      {list.length} person{list.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: '0.88rem' }}>
            <i className="bi bi-calendar-check" style={{ display: 'block', fontSize: '2rem', marginBottom: 8 }}></i>
            No leave or training recorded for {monthName} {data.year}.
          </div>
        )}

        {/* Leave Count Section */}
        {curRole === 'admin' || curRole === 'management' ? (
          <div className="lc-summary-card" style={{ marginTop: 16 }}>
            <div className="lc-summary-hdr">
              <i className="bi bi-bar-chart-line"></i> {monthName} Leave Count – All
            </div>
            {data.leave_counts_list && data.leave_counts_list.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '10px 18px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Name</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#991b1b' }}>
                        <i className="bi bi-x-circle-fill" style={{ fontSize: '0.75rem' }}></i> Leave
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#92400e' }}>
                        <i className="bi bi-book-fill" style={{ fontSize: '0.75rem' }}></i> Training
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#5b21b6' }}>
                        <i className="bi bi-clock-fill" style={{ fontSize: '0.75rem' }}></i> Half Day
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#1a1f3a' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leave_counts_list.map((cnt: any) => (
                      <tr key={cnt.uid} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '9px 18px', fontWeight: 600, color: '#1a1f3a' }}>
                          <i className="bi bi-person-fill" style={{ color: '#9ca3af', marginRight: 6 }}></i>
                          {cnt.name}
                        </td>
                        <td style={{ padding: '9px 16px', textAlign: 'center' }}>
                          {cnt.leave ? (
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>
                              {cnt.leave}
                            </span>
                          ) : (
                            <span style={{ color: '#d1d5db' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 16px', textAlign: 'center' }}>
                          {cnt.training ? (
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>
                              {cnt.training}
                            </span>
                          ) : (
                            <span style={{ color: '#d1d5db' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 16px', textAlign: 'center' }}>
                          {cnt.half_day ? (
                            <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>
                              {cnt.half_day}
                            </span>
                          ) : (
                            <span style={{ color: '#d1d5db' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 16px', textAlign: 'center' }}>
                          <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>
                            {cnt.total}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '18px 20px', color: '#9ca3af', fontSize: '0.83rem' }}>
                No leave recorded for {monthName} {data.year}.
              </div>
            )}
          </div>
        ) : user ? (
          <div className="lc-summary-card" style={{ marginTop: 16 }}>
            <div className="lc-summary-hdr">
              <i className="bi bi-person-check"></i> Your Leave Count – {monthName}
            </div>
            {myCount ? (
              <div style={{ display: 'flex', gap: 16, padding: '16px 20px', flexWrap: 'wrap' }}>
                {[
                  { bg: '#fee2e2', num: '#ef4444', lbl: '#991b1b', v: myCount.leave, t: 'Leave' },
                  { bg: '#fef3c7', num: '#f59e0b', lbl: '#92400e', v: myCount.training, t: 'Training' },
                  { bg: '#ede9fe', num: '#8b5cf6', lbl: '#5b21b6', v: myCount.half_day, t: 'Half Day' },
                  { bg: '#f3f4f6', num: '#374151', lbl: '#6b7280', v: myCount.total, t: 'Total' },
                ].map((b) => (
                  <div
                    key={b.t}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: b.bg,
                      borderRadius: 10,
                      padding: '14px 24px',
                      minWidth: 90,
                    }}
                  >
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: b.num }}>{b.v}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: b.lbl, marginTop: 4 }}>{b.t}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '18px 20px', color: '#9ca3af', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="bi bi-check-circle" style={{ fontSize: '1.1rem', color: '#86efac' }}></i>
                No leave recorded for you in {monthName} {data.year}.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Add Leave Modal */}
      <div
        className={`lc-modal-overlay${modalOpen ? ' open' : ''}`}
        id="lc-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div className="lc-modal">
          <div className="lc-modal-hdr">
            <span id="modal-title">Mark Leave / Training</span>
            <button className="lc-modal-close" onClick={closeModal}>
              &#x2715;
            </button>
          </div>
          <div className="lc-modal-body">
            <div className="lc-modal-date">
              <i className="bi bi-calendar3"></i>
              <span id="modal-date-label">{currentDate}</span>
            </div>
            <div className="lc-status-tabs">
              <div
                className={'lc-tab' + (currentStatus === 'LEAVE' ? ' active-leave' : '')}
                id="tab-leave"
                onClick={() => setCurrentStatus('LEAVE')}
              >
                🔴 Leave
              </div>
              <div
                className={'lc-tab' + (currentStatus === 'TRAINING' ? ' active-training' : '')}
                id="tab-training"
                onClick={() => setCurrentStatus('TRAINING')}
              >
                🟡 Training
              </div>
              <div
                className={'lc-tab' + (currentStatus === 'HALF_DAY' ? ' active-half-day' : '')}
                id="tab-half-day"
                onClick={() => setCurrentStatus('HALF_DAY')}
              >
                🟣 Half Day
              </div>
            </div>
            <div className="lc-session-tabs" id="session-tabs" style={{ display: currentStatus === 'HALF_DAY' ? 'flex' : 'none' }}>
              <div className={'lc-session-btn' + (currentSession === 'AM' ? ' active' : '')} id="session-am" onClick={() => setCurrentSession('AM')}>
                🌅 Morning
              </div>
              <div className={'lc-session-btn' + (currentSession === 'PM' ? ' active' : '')} id="session-pm" onClick={() => setCurrentSession('PM')}>
                🌆 Evening
              </div>
            </div>
            <div className="lc-user-grid" id="modal-user-grid">
              {modalOpen &&
                allUsers.map((u) => {
                  const uid = String(u.id);
                  const info = dayLeave[uid];
                  const isSameStatus = !!info && info.status === finalSt;
                  const cls =
                    'lc-user-btn' +
                    (info && info.status === 'LEAVE' ? ' on-leave' : '') +
                    (info && info.status === 'TRAINING' ? ' on-training' : '') +
                    (info && (info.status === 'HALF_DAY_AM' || info.status === 'HALF_DAY_PM') ? ' on-half-day' : '');
                  const initial = (u.full_name || '?')[0].toUpperCase();
                  const sessionLabel = info && info.status === 'HALF_DAY_AM' ? ' AM' : info && info.status === 'HALF_DAY_PM' ? ' PM' : '';
                  const statusIcon = isSameStatus ? '✓ ' : '';
                  return (
                    <button
                      key={uid}
                      type="button"
                      className={cls}
                      title={isSameStatus ? `Click to remove for ${u.full_name}` : `Mark ${u.full_name} as ${finalSt.replace('_', ' ')}`}
                      onClick={() => submitLeave(uid, isSameStatus)}
                    >
                      <div className="lc-user-avatar">{initial}</div>
                      <span>
                        {statusIcon}
                        {u.full_name.split(' ')[0]}
                        {sessionLabel}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

export default function LeaveCalendarPage() {
  return (
    <Suspense fallback={null}>
      <LeaveCalendarInner />
    </Suspense>
  );
}
