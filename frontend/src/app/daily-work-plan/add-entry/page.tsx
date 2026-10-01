'use client';
import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePageData } from '@/hooks/usePageData';
import { useAction } from '@/context/Flash';
import { qs } from '@/lib/api';

function AddEntryInner() {
  const sp = useSearchParams();
  const date = sp.get('date') || '';
  const userId = sp.get('user_id') || '';
  const { data } = usePageData<{ pre_date: string; pre_user: string; users: any[] }>(
    '/api/pages/add-entry' + qs({ date, user_id: userId })
  );
  const run = useAction();
  const [status, setStatus] = useState('IN PROGRESS');

  if (!data) return null;
  const { pre_date, pre_user, users } = data;

  const hide = ['LEAVE', 'TRAINING'].includes(status);
  const op = { opacity: hide ? 0.3 : 1 };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run('POST', '/api/actions/daily-work-plan/add-entry', new FormData(e.currentTarget));
  }

  // Original compared u.id == pre_user with Jinja strict semantics (int vs str) -> kept as-is
  const preSel = users.find((u: any) => u.id === pre_user) ? pre_user : '';
  const backHref = '/daily-work-plan' + qs({ date: pre_date });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Add Daily Plan Entry</h1>
          <p className="page-subtitle">Record work activity for a team member</p>
        </div>
        <Link href={backHref} className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left me-1"></i>Back
        </Link>
      </div>
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header"><i className="bi bi-plus-circle me-2"></i>New Entry</div>
            <div className="card-body p-4">
              <form onSubmit={onSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Plan Date <span className="text-danger">*</span></label>
                    <input type="date" className="form-control" name="plan_date" defaultValue={pre_date} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Team Member <span className="text-danger">*</span></label>
                    <select className="form-select" name="user_id" required defaultValue={preSel}>
                      <option value="">-- Select Member --</option>
                      {users.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name}
                          {u.team ? ` (${u.team})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Status <span className="text-danger">*</span></label>
                    <select className="form-select" name="status" id="statusSelect" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="IN PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="LEAVE">Leave</option>
                      <option value="TRAINING">Training</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </div>
                  <div className="col-md-6" id="projectField" style={op}>
                    <label className="form-label">Project / Task</label>
                    <input type="text" className="form-control" name="project_name" placeholder="e.g. JV Fletcher CO9 Fab" />
                  </div>
                  <div className="col-md-6" id="clientField" style={op}>
                    <label className="form-label">Client Name</label>
                    <input type="text" className="form-control" name="client_name" placeholder="e.g. VILLAGE FORGE" />
                  </div>
                  <div className="col-md-6"></div>
                  <div className="col-md-4" id="subField" style={op}>
                    <label className="form-label">Submission Date</label>
                    <input type="date" className="form-control" name="submission_date" />
                  </div>
                  <div className="col-md-4" id="recField" style={op}>
                    <label className="form-label">Received Date</label>
                    <input type="date" className="form-control" name="received_date" />
                  </div>
                  <div className="col-md-4" id="submField" style={op}>
                    <label className="form-label">Submitted Date</label>
                    <input type="date" className="form-control" name="submitted_date" />
                  </div>
                  <div className="col-12" id="notesField" style={op}>
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" name="notes" rows={2} placeholder="Optional notes..."></textarea>
                  </div>
                </div>
                <div className="d-flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary px-4"><i className="bi bi-check-lg me-1"></i>Save Entry</button>
                  <Link href={backHref} className="btn btn-outline-secondary">Cancel</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AddEntryPage() {
  return (
    <Suspense fallback={null}>
      <AddEntryInner />
    </Suspense>
  );
}
