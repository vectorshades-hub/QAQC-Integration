'use client';
import { useEffect, useRef, useState } from 'react';
import { Collapse } from 'react-bootstrap';
import { usePageData } from '@/hooks/usePageData';
import { apiGet, apiPost } from '@/lib/api';

const labelStyle = { fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 } as const;

export default function SettingsPage() {
  const { data, reload } = usePageData<any>('/api/pages/settings');

  const [backupRunning, setBackupRunning] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [importRunning, setImportRunning] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true });

  const timers = useRef<any[]>([]);
  const intervals = useRef<any[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      intervals.current.forEach(clearInterval);
    },
    []
  );

  // location.reload() in the original: fresh page state (status text cleared, first accordion open) + fresh data
  const softReload = () => {
    setBackupStatus('');
    setImportStatus('');
    setOpen({ 1: true });
    reload();
  };

  const runBackupNow = async () => {
    setBackupRunning(true);
    setBackupStatus('');
    try {
      const pre = await apiGet('/api/backup/status');
      const before = pre.last_backup || '';
      // Flask's flash("Backup started...") was consumed by the redirected fetch response and never displayed here,
      // so the flash returned by the API is intentionally ignored.
      await apiPost('/api/actions/backup-excel');
      let statusText = 'Backup started — checking for completion…';
      setBackupStatus(statusText);
      let poll: any = setInterval(() => {
        apiGet('/api/backup/status')
          .then((d) => {
            if (poll && d.last_backup && d.last_backup !== before) {
              clearInterval(poll);
              poll = null;
              statusText = 'Backup complete — ' + d.last_backup;
              setBackupStatus(statusText);
              setBackupRunning(false);
              timers.current.push(
                setTimeout(() => softReload(), 1500)
              );
            }
          })
          .catch(() => {});
      }, 2000);
      intervals.current.push(poll);
      // stop polling after 2 minutes
      timers.current.push(
        setTimeout(() => {
          if (poll) {
            clearInterval(poll);
            setBackupRunning(false);
            if (!statusText.startsWith('Backup complete')) {
              setBackupStatus('Backup running in background — reload to see files.');
            }
          }
        }, 120000)
      );
    } catch {
      setBackupStatus('Error starting backup.');
      setBackupRunning(false);
    }
  };

  const runImportNow = async () => {
    setImportRunning(true);
    setImportStatus('');
    try {
      await apiPost('/api/st-import/run-now');
      setImportStatus('Import started — watch for the notification…');
      let before: string | null = null;
      try {
        before = localStorage.getItem('stLastSeenImport');
      } catch {}
      const poll = setInterval(() => {
        apiGet('/api/st-import/status')
          .then((d) => {
            if (d.time_iso && d.time_iso !== before) {
              clearInterval(poll);
              const msg =
                d.inserted > 0
                  ? `Done — ${d.inserted} imported, ${d.skipped} skipped`
                  : `Done — no new records (${d.skipped} already up to date)`;
              setImportStatus(msg);
              setImportRunning(false);
              timers.current.push(setTimeout(() => softReload(), 1500));
            }
          })
          .catch(() => {});
      }, 2000);
      intervals.current.push(poll);
    } catch {
      setImportStatus('Error starting import.');
      setImportRunning(false);
    }
  };

  const folders: any[] = data?.backup_folders || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-gear me-2"></i>Settings
          </h1>
          <p className="page-subtitle">Application configuration (admin only)</p>
        </div>
      </div>

      {data && (
        <div className="row g-4" style={{ maxWidth: 720 }}>
          {/* Manual Backup */}
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex align-items-center gap-2">
                <i className="bi bi-archive text-primary"></i>
                Data Backup
              </div>
              <div className="card-body p-4">
                <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>
                  Every day at midnight IST the system saves 4 Excel files (Daily Work Plan, Work Plan, Submission Log, Leave
                  Calendar) covering the last 2 months into <code>data/backup/YYYY-MM-DD/</code>. Folders older than 60 days are
                  pruned automatically.
                </p>

                <div className="row g-3 mb-4">
                  <div className="col-auto">
                    <div className="p-3 rounded" style={{ background: '#f0f4ff', border: '1px solid #d0d9f0', minWidth: 180 }}>
                      <div style={labelStyle}>
                        <i className="bi bi-clock me-1"></i> Daily backup time
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1f3a', fontFamily: "'Syne',sans-serif" }}>
                        00:00 <span style={{ fontSize: '.85rem', fontWeight: 500, color: '#6b7280' }}>IST</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-auto">
                    <div className="p-3 rounded" style={{ background: '#f0fff4', border: '1px solid #bbf7d0', minWidth: 220 }}>
                      <div style={labelStyle}>
                        <i className="bi bi-calendar2-check me-1"></i> Next scheduled backup
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#065f46' }}>{data.next_backup}</div>
                    </div>
                  </div>
                  <div className="col-auto">
                    <div className="p-3 rounded" style={{ background: '#fafafa', border: '1px solid #e5e7eb', minWidth: 200 }}>
                      <div style={labelStyle}>
                        <i className="bi bi-clock-history me-1"></i> Last backup
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 600, color: '#1a1f3a' }}>{data.last_backup}</div>
                    </div>
                  </div>
                </div>

                <button type="button" id="runBackupBtn" className="btn btn-outline-primary" onClick={runBackupNow} disabled={backupRunning}>
                  {backupRunning ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1"></span> Running…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-arrow-up me-1"></i> Run Backup Now
                    </>
                  )}
                </button>
                <span id="backupStatus" className="ms-3" style={{ fontSize: '.85rem', color: '#6b7280' }}>
                  {backupStatus}
                </span>

                {folders.length > 0 ? (
                  <>
                    <hr className="my-4" />
                    <h6 className="mb-3" style={{ color: '#1a1f3a', fontWeight: 600 }}>
                      Recent Backups
                    </h6>
                    <div className="accordion" id="backupAccordion">
                      {folders.map((folder, idx) => {
                        const n = idx + 1;
                        const isOpen = !!open[n];
                        return (
                          <div key={folder.date} className="accordion-item border mb-2 rounded" style={{ borderColor: '#e5e7eb' }}>
                            <h2 className="accordion-header">
                              <button
                                className={`accordion-button ${!isOpen ? 'collapsed' : ''} py-2 px-3`}
                                type="button"
                                onClick={() => setOpen((o) => ({ ...o, [n]: !o[n] }))}
                                aria-expanded={isOpen}
                                style={{ fontSize: '.875rem', fontWeight: 600, background: '#f8faff', color: '#1a1f3a' }}
                              >
                                <i className="bi bi-folder2 me-2 text-primary"></i>
                                {folder.date}
                                <span className="ms-2 badge bg-secondary" style={{ fontSize: '.7rem' }}>
                                  {folder.files.length} files
                                </span>
                              </button>
                            </h2>
                            <Collapse in={isOpen}>
                              <div id={`bk${n}`} className="accordion-collapse">
                                <div className="accordion-body py-2 px-3">
                                  <div className="list-group list-group-flush">
                                    {folder.files.map((f: any) => (
                                      <div
                                        key={f.path}
                                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center px-0 py-2 border-0 border-bottom"
                                        style={{ fontSize: '.85rem' }}
                                      >
                                        <span>
                                          <i className="bi bi-file-earmark-spreadsheet me-2 text-success"></i>
                                          {f.name}
                                        </span>
                                        <span className="d-flex align-items-center gap-3">
                                          <span className="text-muted" style={{ fontSize: '.78rem' }}>
                                            {f.size_kb} KB
                                          </span>
                                          <a
                                            href={`/api/backup/download/${f.path}`}
                                            className="btn btn-sm btn-outline-secondary py-0 px-2"
                                            style={{ fontSize: '.78rem' }}
                                          >
                                            <i className="bi bi-download"></i>
                                          </a>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </Collapse>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-muted mt-3 mb-0" style={{ fontSize: '.85rem' }}>
                    No backups found yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Schedule Track Auto-Import */}
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex align-items-center gap-2">
                <i className="bi bi-calendar-event text-primary"></i>
                Schedule Track Auto-Import
              </div>
              <div className="card-body p-4">
                <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>
                  Every day at the configured time the system automatically pulls upcoming records from Schedule Track into the
                  Work Plan (next 30 days, active records only). Already-imported records are skipped even if their date was
                  changed in Schedule Track. To change the time, update <code>ST_AUTO_IMPORT_TIME</code> at the top of{' '}
                  <code>app.py</code>.
                </p>

                <div className="row g-3 mb-4">
                  <div className="col-auto">
                    <div className="p-3 rounded" style={{ background: '#f0f4ff', border: '1px solid #d0d9f0', minWidth: 180 }}>
                      <div style={labelStyle}>
                        <i className="bi bi-clock me-1"></i> Daily import time
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1f3a', fontFamily: "'Syne',sans-serif" }}>
                        {data.st_auto_import_time}{' '}
                        <span style={{ fontSize: '.85rem', fontWeight: 500, color: '#6b7280' }}>IST</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-auto">
                    <div className="p-3 rounded" style={{ background: '#f0fff4', border: '1px solid #bbf7d0', minWidth: 220 }}>
                      <div style={labelStyle}>
                        <i className="bi bi-calendar2-check me-1"></i> Next scheduled run
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#065f46' }}>{data.next_run}</div>
                    </div>
                  </div>
                  <div className="col-auto">
                    <div className="p-3 rounded" style={{ background: '#fafafa', border: '1px solid #e5e7eb', minWidth: 200 }}>
                      <div style={labelStyle}>
                        <i className="bi bi-clock-history me-1"></i> Last auto-import
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 600, color: '#1a1f3a' }}>{data.last_st_import}</div>
                    </div>
                  </div>
                </div>

                <button type="button" id="runNowBtn" className="btn btn-outline-success" onClick={runImportNow} disabled={importRunning}>
                  {importRunning ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1"></span> Running…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-play-fill me-1"></i> Run Import Now
                    </>
                  )}
                </button>
                <span id="runNowStatus" className="ms-3" style={{ fontSize: '.85rem', color: '#6b7280' }}>
                  {importStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
