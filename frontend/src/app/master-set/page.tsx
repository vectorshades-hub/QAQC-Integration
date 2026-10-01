'use client';
import Link from 'next/link';
import { FormEvent } from 'react';
import { usePageData } from '@/hooks/usePageData';
import { useAction } from '@/context/Flash';

const css = `
.ms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 18px;
}
.ms-job-card {
    background: #fff;
    border-radius: 14px;
    border: 1.5px solid #e5e7eb;
    box-shadow: 0 2px 12px rgba(26,31,58,0.05);
    overflow: hidden;
    transition: box-shadow 0.2s, transform 0.15s;
    display: flex; flex-direction: column;
}
.ms-job-card:hover {
    box-shadow: 0 8px 28px rgba(26,31,58,0.12);
    transform: translateY(-2px);
}
.ms-card-top {
    background: linear-gradient(135deg, #1a1f3a, #2d3561);
    padding: 14px 18px 12px;
}
.ms-card-top .job-title {
    font-family: 'Syne', sans-serif;
    font-weight: 700; font-size: 0.88rem;
    color: #fff; margin: 0 0 4px;
    line-height: 1.3;
}
.ms-card-top .fab-name {
    font-size: 0.73rem; color: rgba(255,255,255,0.6);
    font-weight: 500;
}
.ms-card-body { padding: 14px 18px; flex: 1; }
.ms-meta-row {
    display: flex; gap: 6px; flex-wrap: wrap;
    margin-bottom: 10px;
}
.ms-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: #f3f4f6; border-radius: 6px;
    padding: 3px 8px; font-size: 0.72rem;
    font-weight: 600; color: #374151;
}
.ms-chip.blue  { background: #dbeafe; color: #1e40af; }
.ms-chip.green { background: #d1fae5; color: #065f46; }
.ms-chip.purple{ background: #ede9fe; color: #5b21b6; }
.upd-count {
    font-size: 0.75rem; color: #6b7280;
    display: flex; align-items: center; gap: 5px;
    margin-top: 6px;
}
.ms-card-actions {
    border-top: 1px solid #f0f2f5;
    padding: 10px 18px;
    display: flex; gap: 6px;
}
.abtn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 12px; border-radius: 8px;
    font-size: 0.78rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
    border: none; text-decoration: none;
    white-space: nowrap;
}
.abtn-primary { background: #1a1f3a; color: #fff; }
.abtn-primary:hover { background: #2d3561; color: #fff; }
.abtn-success { background: #059669; color: #fff; }
.abtn-success:hover { background: #047857; color: #fff; }
.abtn-outline {
    background: #fff; color: #374151;
    border: 1.5px solid #e5e7eb;
}
.abtn-outline:hover { background: #f3f4f6; }
.abtn-danger { background: #fff1f2; color: #e11d48; border: 1.5px solid #fecdd3; }
.abtn-danger:hover { background: #e11d48; color: #fff; }

/* Add form */
.add-card {
    background: #fff;
    border-radius: 16px;
    border: 1.5px solid #e5e7eb;
    box-shadow: 0 4px 20px rgba(26,31,58,0.06);
    overflow: hidden;
    margin-bottom: 28px;
}
.add-card-header {
    background: linear-gradient(135deg, #0f766e, #0d9488);
    padding: 14px 22px;
    display: flex; align-items: center; gap: 10px;
}
.add-card-header h2 {
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.95rem; color: #fff; margin: 0;
}
.form-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px 18px;
    padding: 20px 22px;
}
.form-grid .span2 { grid-column: span 2; }
.form-grid .span3 { grid-column: span 3; }
.ff { display: flex; flex-direction: column; gap: 5px; }
.ff label { font-size: 0.78rem; font-weight: 600; color: #374151; }
.ff label .req { color: #e84c4c; }
.fctrl {
    width: 100%; padding: 9px 12px;
    border: 1.5px solid #e5e7eb; border-radius: 9px;
    font-size: 0.84rem; font-family: 'DM Sans', sans-serif;
    color: #1a1f3a; transition: border-color 0.15s;
    background: #fff;
}
.fctrl:focus { outline: none; border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
.form-actions {
    padding: 14px 22px;
    border-top: 1px solid #f0f2f5;
    background: #fafbfc;
    display: flex; gap: 8px;
}
.empty-state {
    grid-column: 1/-1;
    text-align: center; padding: 60px 20px;
    color: #9ca3af;
}
.empty-state i { font-size: 2.5rem; display: block; margin-bottom: 12px; }
`;

export default function MasterSetPage() {
  const { data } = usePageData('/api/pages/master-set');
  const run = useAction();

  if (!data) return null;

  const ms_list: any[] = data.ms_list || [];
  const projects: string[] = data.projects || [];
  const clients: string[] = data.clients || [];
  const teams: string[] = data.teams || [];
  const checkers: string[] = data.checkers || [];
  const today: string = data.today || ''; // Flask route never passed `today` -> empty date

  const onAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await run('POST', '/api/actions/master-set/add', new FormData(e.currentTarget));
  };

  const onDelete = async (e: FormEvent<HTMLFormElement>, id: number) => {
    e.preventDefault();
    if (!confirm('Delete this Project Master Set?')) return;
    await run('POST', `/api/actions/master-set/${id}/delete`);
  };

  return (
    <>
      <style>{css}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-archive-fill me-2" style={{ color: '#0d9488' }}></i>Project Master Set
          </h1>
          <p className="page-subtitle">Manage job project master sets and track updates</p>
        </div>
        <button
          className="btn-accent"
          onClick={() => document.getElementById('addForm')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <i className="bi bi-plus-lg me-1"></i> New Project Master Set
        </button>
      </div>

      {/* Job Cards */}
      {ms_list.length > 0 ? (
        <div className="ms-grid mb-4">
          {ms_list.map((ms) => {
            const n = ms.updates ? ms.updates.length : Number(ms.update_count || 0);
            return (
              <div className="ms-job-card" key={ms.id}>
                <div className="ms-card-top">
                  <p className="job-title">{ms.job_name}</p>
                  <p className="fab-name">
                    <i className="bi bi-building me-1"></i>
                    {ms.fabricator || '—'} &nbsp;·&nbsp; {ms.client || '—'}
                  </p>
                </div>
                <div className="ms-card-body">
                  <div className="ms-meta-row">
                    {ms.team && (
                      <span className="ms-chip purple">
                        <i className="bi bi-people-fill"></i> {ms.team}
                      </span>
                    )}
                    {ms.received_date && (
                      <span className="ms-chip blue">
                        <i className="bi bi-calendar3"></i> {ms.received_date}
                      </span>
                    )}
                    {ms.working_days && (
                      <span className="ms-chip green">
                        <i className="bi bi-clock"></i> {ms.working_days} days
                      </span>
                    )}
                  </div>
                  <div className="upd-count">
                    <i className="bi bi-journal-text"></i>
                    {n} update{n !== 1 ? 's' : ''}
                    &nbsp;·&nbsp; Added by {ms.submitted_by}
                  </div>
                </div>
                <div className="ms-card-actions">
                  <Link href={`/master-set/${ms.id}`} className="abtn abtn-primary">
                    <i className="bi bi-pencil-fill"></i> Open / Edit
                  </Link>
                  <a href={`/api/actions/master-set/${ms.id}/export`} className="abtn abtn-success">
                    <i className="bi bi-file-earmark-excel"></i> Excel
                  </a>
                  <form style={{ margin: 0 }} onSubmit={(e) => onDelete(e, ms.id)}>
                    <button type="submit" className="abtn abtn-danger">
                      <i className="bi bi-trash-fill"></i>
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ms-grid mb-4">
          <div className="empty-state">
            <i className="bi bi-archive"></i>
            No Project Master Sets yet. Create one below.
          </div>
        </div>
      )}

      {/* Add Form */}
      <div className="add-card" id="addForm">
        <div className="add-card-header">
          <i className="bi bi-plus-circle-fill" style={{ color: '#fff', fontSize: '1.1rem' }}></i>
          <h2>New Project Master Set</h2>
        </div>
        <form onSubmit={onAdd}>
          <div className="form-grid">
            <div className="ff span2">
              <label>
                Job Name <span className="req">*</span>
              </label>
              <input
                type="text"
                name="job_name"
                className="fctrl"
                list="jobList"
                placeholder="e.g. 21843_South College Century Parkway…"
                required
                autoComplete="off"
              />
              <datalist id="jobList">
                {projects.map((p, i) => (
                  <option key={i} value={p} />
                ))}
              </datalist>
            </div>
            <div className="ff">
              <label>Client</label>
              <input
                type="text"
                name="client"
                className="fctrl"
                list="clientList"
                placeholder="Client name…"
                autoComplete="off"
              />
              <datalist id="clientList">
                {clients.map((c, i) => (
                  <option key={i} value={c} />
                ))}
              </datalist>
            </div>

            <div className="ff">
              <label>Fabricator / Fabricator #</label>
              <input type="text" name="fabricator" className="fctrl" placeholder="e.g. GSMETAL METAL SUPPLY" />
            </div>
            <div className="ff">
              <label>Team</label>
              <input
                type="text"
                name="team"
                className="fctrl"
                list="teamList"
                placeholder="Team name…"
                autoComplete="off"
              />
              <datalist id="teamList">
                {teams.map((t, i) => (
                  <option key={i} value={t} />
                ))}
              </datalist>
            </div>
            <div className="ff">
              <label>QC Checker</label>
              <input
                type="text"
                name="qc_checker"
                className="fctrl"
                list="checkerList"
                placeholder="Assigned checker…"
                autoComplete="off"
              />
              <datalist id="checkerList">
                {checkers.map((c, i) => (
                  <option key={i} value={c} />
                ))}
              </datalist>
            </div>

            <div className="ff">
              <label>Received Date</label>
              <input type="date" name="received_date" className="fctrl" defaultValue={today} />
            </div>
            <div className="ff">
              <label>Working Days</label>
              <input type="number" name="working_days" className="fctrl" min="1" placeholder="e.g. 2" />
            </div>
            <div className="ff"></div>

            <div className="ff span3">
              <label>
                Email Body <span style={{ fontWeight: 400, color: '#6b7280' }}>(paste the job email content)</span>
              </label>
              <textarea
                name="email_body"
                className="fctrl"
                rows={6}
                placeholder="Paste the received email body here…"
                style={{ resize: 'vertical' }}
              ></textarea>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="abtn abtn-primary">
              <i className="bi bi-check-lg"></i> Create Project Master Set
            </button>
            <button type="reset" className="abtn abtn-outline">
              <i className="bi bi-x-lg"></i> Clear
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
