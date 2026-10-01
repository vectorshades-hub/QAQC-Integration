'use client';
import { kindFromBg, useToastApi } from '@/context/Toast';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { useAction } from '@/context/Flash';
import { usePageData } from '@/hooks/usePageData';

const css = `
.ol-detail-banner {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 14px; padding: 18px 22px; margin-bottom: 22px;
    display: flex; align-items: flex-start; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
    box-shadow: 0 2px 10px rgba(26,31,58,.04);
}
.ol-detail-banner .job-name {
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.15rem;
    color: #1a1f3a; margin: 0 0 8px;
}
.ol-detail-banner .meta-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.meta-chip {
    background: #f3f4f6; color: #374151;
    border-radius: 6px; padding: 3px 10px;
    font-size: 0.75rem; font-weight: 600;
    border: 1px solid #e5e7eb;
    display: inline-flex; align-items: center; gap: 5px;
}

/* ── Two-column layout ───────────────────────────────── */
.detail-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
}
@media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; } }

/* ── Cards ───────────────────────────────────────────── */
.det-card {
    background: #fff; border: 1.5px solid #e5e7eb; border-radius: 14px;
    overflow: hidden; box-shadow: 0 2px 12px rgba(26,31,58,.05);
}
.det-card-header {
    padding: 12px 18px; display: flex; align-items: center; gap: 10px;
}
.det-card-header h3 {
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.88rem;
    color: #fff; margin: 0;
}
.hdr-ownership { background: linear-gradient(135deg, #c2410c, #ea580c); }
.hdr-qc        { background: linear-gradient(135deg, #0f766e, #0d9488); }
.hdr-info      { background: linear-gradient(135deg, #1a1f3a, #2d3561); }
.det-card-body { padding: 18px; }

/* ── Form fields ─────────────────────────────────────── */
.ff { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.ff:last-child { margin-bottom: 0; }
.ff label { font-size: 0.75rem; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .5px; }
.fctrl {
    width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px;
    font-size: 0.84rem; font-family: 'DM Sans', sans-serif; color: #1a1f3a;
    background: #fff;
}
.fctrl:focus { outline: none; border-color: #c2410c; box-shadow: 0 0 0 3px rgba(194,65,12,.1); }
.fctrl-teal:focus { outline: none; border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,.1); }
.fctrl[readonly] { background: #f9fafb; color: #6b7280; cursor: default; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }

/* ── Action bar ──────────────────────────────────────── */
.act-bar {
    border-top: 1px solid #f0f2f5; padding: 14px 18px;
    background: #fafbfc; display: flex; gap: 8px; flex-wrap: wrap;
}
.abtn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 8px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
    cursor: pointer; border: none; text-decoration: none; white-space: nowrap;
    transition: all .15s;
}
.abtn-orange  { background: #c2410c; color: #fff; }
.abtn-orange:hover { background: #9a3412; color: #fff; }
.abtn-teal   { background: #0d9488; color: #fff; }
.abtn-teal:hover { background: #0f766e; color: #fff; }
.abtn-outline {
    background: #fff; color: #374151; border: 1.5px solid #e5e7eb;
}
.abtn-outline:hover { background: #f3f4f6; }
.abtn-dark { background: #1a1f3a; color: #fff; }
.abtn-dark:hover { background: #2d3561; color: #fff; }

/* ── Info rows ───────────────────────────────────────── */
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 0.83rem; }
.info-row:last-child { border-bottom: none; }
.info-row .lbl { color: #6b7280; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .4px; }
.info-row .val { font-weight: 600; color: #1a1f3a; }

/* ── Update table ────────────────────────────────────── */
.upd-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.upd-table th { background: #f8f9fc; padding: 8px 10px; font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: .4px; color: #6b7280; border-bottom: 1.5px solid #e5e7eb; }
.upd-table td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
.upd-table tr:last-child td { border-bottom: none; }
`;

const STATUS_OPTS = ['AB & EMBED DONE', 'AB OFA COMPLETED', 'CUSTOMER DROPPED', 'FAB COMPLETED', 'HOLD', 'IFF COMPLETED', 'IFF DONE', 'OFA COMPLETED', 'OFA DONE', 'OFA PROGRESSING', 'PARTIAL DONE'];

export default function OwnershipLogDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const run = useAction();
  const { data } = usePageData<any>(id ? `/api/pages/ownership-log/${id}` : null);

  const toastApi = useToastApi();
  const showPathToast = (msg: string, bg?: string) => toastApi.show(kindFromBg(bg), msg);

  const copyOr = async (path: string, failMsg: string) => {
    try {
      await navigator.clipboard.writeText(path);
      showPathToast('Path copied to clipboard', '#059669');
    } catch {
      showPathToast(failMsg, '#e11d48');
    }
  };
  const openMsFolder = async (path: string) => {
    const d = await apiPost('/api/actions/open-folder', { path });
    if (d.status === 0) {
      copyOr(path, 'Could not open folder');
    } else if (!d.ok) {
      copyOr(path, 'Could not open path — drive may be inaccessible');
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await run('POST', `/api/actions/ownership-log/${id}/edit`, new FormData(e.currentTarget));
  };

  if (!data) return <style>{css}</style>;

  const { ms_id, rec, updates = [], checkers = [], all_domains = [], all_clients = [], is_admin } = data;

  return (
    <>
      <title>{`Ownership – ${rec.job_name} – QAQC`}</title>
      <style>{css}</style>

      {/* ── Back + Title ── */}
      <div className="page-header mb-3">
        <div>
          <Link href="/ownership-log" className="abtn abtn-outline mb-2 d-inline-flex">
            <i className="bi bi-arrow-left"></i> Ownership Log
          </Link>
          <h1 className="page-title" style={{ fontSize: '1.35rem' }}>
            <i className="bi bi-clipboard2-data-fill me-2" style={{ color: '#c2410c' }}></i>Ownership Detail
          </h1>
        </div>
        <Link href={`/master-set/${ms_id}`} className="abtn abtn-dark">
          <i className="bi bi-archive-fill me-1"></i> Full Master Set
        </Link>
      </div>

      {/* ── Job Banner ── */}
      <div className="ol-detail-banner">
        <div>
          <p className="job-name">{rec.job_name}</p>
          <div className="meta-chips">
            {rec.client && <span className="meta-chip"><i className="bi bi-building"></i>{rec.client}</span>}
            {rec.team && <span className="meta-chip"><i className="bi bi-people-fill"></i>{rec.team}</span>}
            {rec.received_date && <span className="meta-chip"><i className="bi bi-calendar3"></i>{rec.received_date}</span>}
            {rec.working_days && <span className="meta-chip"><i className="bi bi-clock"></i>{rec.working_days} days</span>}
            <span className="meta-chip"><i className="bi bi-hash"></i>ID {rec.id}</span>
          </div>
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div className="detail-grid">
        {/* LEFT */}
        <div>
          <div className="det-card mb-4">
            <div className="det-card-header hdr-ownership">
              <i className="bi bi-building-fill" style={{ color: '#fff' }}></i>
              <h3>Ownership Details</h3>
            </div>
            <form key={JSON.stringify(rec)} method="POST" onSubmit={onSubmit}>
              <div className="det-card-body">
                <div className="form-row">
                  <div className="ff">
                    <label>Project Name</label>
                    <input type="text" className="fctrl" value={rec.job_name || ''} readOnly />
                  </div>
                  <div className="ff">
                    <label>Domain</label>
                    <input type="text" name="domain" className="fctrl" defaultValue={rec.domain || ''} list="domainList" placeholder="e.g. Structural, Mechanical…" autoComplete="off" />
                    <datalist id="domainList">
                      {all_domains.map((d: string) => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                </div>

                <div className="form-row">
                  <div className="ff">
                    <label>Client</label>
                    {is_admin ? (
                      <>
                        <input type="text" name="client" className="fctrl" defaultValue={rec.client || ''} list="clientList" placeholder="Client name…" autoComplete="off" />
                        <datalist id="clientList">
                          {all_clients.map((c: string) => <option key={c} value={c} />)}
                        </datalist>
                      </>
                    ) : (
                      <input type="text" className="fctrl" value={rec.client || ''} readOnly />
                    )}
                  </div>
                  <div className="ff">
                    <label>QC Checker</label>
                    {is_admin ? (
                      <>
                        <input type="text" name="qc_checker" className="fctrl" defaultValue={rec.qc_checker || ''} list="qcCheckerList" placeholder="QC Checker name…" autoComplete="off" />
                        <datalist id="qcCheckerList">
                          {checkers.map((c: string) => <option key={c} value={c} />)}
                        </datalist>
                      </>
                    ) : (
                      <input type="text" className="fctrl" value={rec.qc_checker || ''} readOnly />
                    )}
                  </div>
                </div>
              </div>

              {/* QC Calendar section (same form, single save) */}
              <div style={{ borderTop: '1.5px solid #e5e7eb' }}>
                <div className="det-card-header hdr-qc" style={{ borderRadius: 0 }}>
                  <i className="bi bi-calendar-check-fill" style={{ color: '#fff' }}></i>
                  <h3>QC Calendar</h3>
                </div>
                <div className="det-card-body">
                  <div className="form-row">
                    <div className="ff">
                      <label>Status</label>
                      <input type="text" name="ol_status" className="fctrl fctrl-teal" defaultValue={rec.ol_status || ''} list="statusList" placeholder="Select or type…" autoComplete="off" />
                      <datalist id="statusList">
                        {STATUS_OPTS.map((opt) => <option key={opt} value={opt} />)}
                      </datalist>
                    </div>
                    <div className="ff">
                      <label>QC Done?</label>
                      <select name="qc_done" className="fctrl fctrl-teal" defaultValue={rec.qc_done || ''}>
                        <option value="">— Select —</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="Partial">Partial</option>
                      </select>
                    </div>
                  </div>

                  <div className="ff">
                    <label>Done By (QC)</label>
                    <input type="text" name="done_by" className="fctrl fctrl-teal" defaultValue={rec.done_by || ''} list="checkerList" placeholder="Who completed the QC…" autoComplete="off" />
                    <datalist id="checkerList">
                      {checkers.map((c: string) => <option key={c} value={c} />)}
                    </datalist>
                  </div>

                  <div className="ff">
                    <label>Remarks</label>
                    <textarea name="ol_remarks" className="fctrl fctrl-teal" rows={3} placeholder="Any notes or remarks…" style={{ resize: 'vertical' }} defaultValue={rec.ol_remarks || ''}></textarea>
                  </div>
                </div>
              </div>

              <div className="act-bar">
                <button type="submit" className="abtn abtn-orange">
                  <i className="bi bi-check-lg"></i> Save Ownership
                </button>
                <Link href="/ownership-log" className="abtn abtn-outline">
                  <i className="bi bi-x-lg"></i> Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <div className="det-card mb-4">
            <div className="det-card-header hdr-info">
              <i className="bi bi-info-circle-fill" style={{ color: '#fff' }}></i>
              <h3>Master Set Info</h3>
            </div>
            <div className="det-card-body">
              {rec.folder_path && (
                <div className="info-row">
                  <span className="lbl">Folder Path</span>
                  <span className="val">
                    <button
                      type="button"
                      onClick={() => openMsFolder(rec.folder_path)}
                      title={rec.folder_path}
                      style={{ background: '#f3f4f6', border: '1.5px solid #e5e7eb', color: '#374151', borderRadius: 6, padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', fontWeight: 600, transition: 'background .15s,color .15s', maxWidth: 180 }}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#1a1f3a'; e.currentTarget.style.color = '#fff'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
                    >
                      <i className="bi bi-folder2-open"></i>
                      <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'inline-block', verticalAlign: 'middle', maxWidth: 130 }}>{rec.folder_path}</span>
                    </button>
                  </span>
                </div>
              )}
              <div className="info-row"><span className="lbl">Fabricator</span><span className="val">{rec.fabricator || '—'}</span></div>
              <div className="info-row"><span className="lbl">Team</span><span className="val">{rec.team || '—'}</span></div>
              <div className="info-row"><span className="lbl">Received Date</span><span className="val">{rec.received_date || '—'}</span></div>
              <div className="info-row"><span className="lbl">Working Days</span><span className="val">{rec.working_days || '—'}</span></div>
              <div className="info-row"><span className="lbl">Submitted By</span><span className="val">{rec.submitted_by || '—'}</span></div>
              <div className="info-row"><span className="lbl">Created At</span>
                <span className="val">{rec.created_at ? String(rec.created_at).slice(0, 10) : '—'}</span></div>
            </div>
            <div className="act-bar">
              <Link href={`/master-set/${ms_id}`} className="abtn abtn-dark">
                <i className="bi bi-pencil-fill me-1"></i> Edit Full Master Set
              </Link>
              <a href={`/api/actions/master-set/${ms_id}/export`} className="abtn abtn-teal">
                <i className="bi bi-file-earmark-excel me-1"></i> Export Excel
              </a>
            </div>
          </div>

          {/* Updates log */}
          {updates.length > 0 && (
            <div className="det-card">
              <div className="det-card-header hdr-info">
                <i className="bi bi-journal-text" style={{ color: '#fff' }}></i>
                <h3>Updates ({updates.length})</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="upd-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {updates.map((upd: any, i: number) => (
                      <tr key={upd.id ?? i}>
                        <td style={{ whiteSpace: 'nowrap', color: '#374151', fontWeight: 600 }}>{upd.upd_date || '—'}</td>
                        <td style={{ color: '#1a1f3a' }}>{upd.remark || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  );
}
