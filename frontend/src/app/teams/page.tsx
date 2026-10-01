'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Modal from 'react-bootstrap/Modal';
import { usePageData } from '@/hooks/usePageData';
import { useAction } from '@/context/Flash';
import { apiPost } from '@/lib/api';

const css = `
.team-card {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px 18px;
    display: flex; align-items: center; gap: 12px;
    transition: box-shadow 0.15s;
    margin-bottom: 8px;
}
.team-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.team-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: linear-gradient(135deg,#1a1f3a,#2d3561);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 1rem; flex-shrink: 0;
}
.team-name { font-family:'Syne',sans-serif; font-weight:700; font-size:0.92rem; color:#1a1f3a; }
.team-id   { font-size:0.72rem; color:#9ca3af; }

.abtn { border:none; border-radius:7px; padding:5px 10px; font-size:0.75rem;
        cursor:pointer; transition:all 0.15s; display:inline-flex; align-items:center; gap:4px; }
.abtn-edit   { background:#eff6ff; color:#2563eb; }
.abtn-edit:hover   { background:#2563eb; color:#fff; }
.abtn-del    { background:#fff1f2; color:#e11d48; }
.abtn-del:hover    { background:#e11d48; color:#fff; }

/* Inline edit form */
.edit-form-row {
    display: none;
    background: #f8faff;
    border: 1.5px solid #bfdbfe;
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 8px;
    gap: 10px; align-items: center;
}
.edit-form-row.show { display: flex; }

/* Add form card */
.add-card {
    background: linear-gradient(135deg,#f8faff,#eff6ff);
    border: 1.5px dashed #93c5fd;
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 16px;
}
`;

type Team = { id: number; name: string; is_active?: boolean };

function TeamItem({ t, onDone }: { t: Team; onDone: () => void }) {
  const run = useAction();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run('POST', `/api/actions/teams/edit/${t.id}`, new FormData(e.currentTarget));
    setEditing(false);
    onDone();
  }
  async function onDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirm(`Delete team ${t.name}? This won't delete plan entries.`)) return;
    await run('POST', `/api/actions/teams/delete/${t.id}`);
  }

  return (
    <>
      {/* Edit form (hidden) */}
      <div className={`edit-form-row${editing ? ' show' : ''}`} id={`ef-${t.id}`}>
        <i className="bi bi-pencil-fill" style={{ color: '#2563eb', flexShrink: 0 }}></i>
        <form method="POST" onSubmit={onSave} className="d-flex gap-2 flex-grow-1">
          <input
            type="text"
            name="name"
            defaultValue={t.name}
            ref={inputRef}
            className="form-control form-control-sm"
            required
            style={{ borderRadius: 8, border: '1.5px solid #93c5fd' }}
          />
          <button type="submit" className="btn btn-sm btn-primary px-3" style={{ borderRadius: 8, whiteSpace: 'nowrap' }}>
            <i className="bi bi-check-lg me-1"></i>Save
          </button>
        </form>
        <button type="button" className="abtn" style={{ background: '#f3f4f6', color: '#6b7280' }} onClick={() => setEditing(false)}>
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      {/* Team row */}
      <div className="team-card" id={`tr-${t.id}`} style={{ display: editing ? 'none' : 'flex' }}>
        <div className="team-icon">
          <i className="bi bi-people-fill"></i>
        </div>
        <div className="flex-grow-1">
          <div className="team-name">{t.name}</div>
          <div className="team-id">ID #{t.id}</div>
        </div>
        <div className="d-flex gap-2">
          <button className="abtn abtn-edit" onClick={() => setEditing(true)}>
            <i className="bi bi-pencil-fill"></i> Edit
          </button>
          <form method="POST" style={{ margin: 0 }} onSubmit={onDelete}>
            <button type="submit" className="abtn abtn-del">
              <i className="bi bi-trash-fill"></i> Delete
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function TeamsPage() {
  const run = useAction();
  const { data, reload } = usePageData<{ teams: Team[] }>('/api/pages/teams');
  const teams: Team[] = data?.teams || [];

  const [mergeOpen, setMergeOpen] = useState(false);
  const [groups, setGroups] = useState<Team[][]>([]);
  const [merged, setMerged] = useState<number[]>([]);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await run('POST', '/api/actions/teams/add', new FormData(form));
    form.reset();
  }

  function openMergeModal() {
    // Detect duplicates client-side from the already-loaded teams list
    const buckets: Record<string, Team[]> = {};
    teams.forEach((t) => {
      const key = t.name.trim().toLowerCase();
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(t);
    });
    setGroups(Object.values(buckets).filter((g) => g.length > 1));
    setMerged([]);
    setMergeOpen(true);
  }

  async function doTeamMerge(groupIndex: number, keepId: number) {
    const group = groups[groupIndex];
    const mergeIds = group.filter((t) => t.id !== keepId).map((t) => t.id);
    for (const mergeId of mergeIds) {
      const res: any = await apiPost('/api/teams/merge', { keep_id: keepId, merge_id: mergeId });
      if (res.status === 0) {
        alert('Network error: ' + (res.error || ''));
        return;
      }
      if (!res.ok) {
        alert('Error: ' + (res.error || 'Unknown error'));
        return;
      }
    }
    setMerged((m) => [...m, groupIndex]);
    setTimeout(() => {
      setMergeOpen(false);
      reload();
    }, 900);
  }

  return (
    <>
      <style>{css}</style>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-diagram-3-fill me-2" style={{ color: '#10b981' }}></i>Teams
          </h1>
          <p className="page-subtitle">Manage work plan teams</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm"
            onClick={openMergeModal}
            style={{ border: '1px solid #8b5cf6', color: '#8b5cf6', borderRadius: 7, padding: '5px 12px' }}
          >
            <i className="bi bi-diagram-2-fill me-1"></i>Merge Duplicates
          </button>
          <Link href="/work-plan" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-calendar3 me-1"></i>Back to Work Plan
          </Link>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-7">
          {/* Add Team */}
          <div className="add-card">
            <p
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: '0.9rem',
                marginBottom: 10,
                color: '#1a1f3a',
              }}
            >
              <i className="bi bi-plus-circle-fill me-2" style={{ color: '#3b82f6' }}></i>Add New Team
            </p>
            <form method="POST" onSubmit={onAdd} className="d-flex gap-2">
              <input
                type="text"
                name="name"
                className="form-control form-control-sm"
                placeholder="Team name e.g. COCHIN MAIN STEEL TEAM"
                required
                style={{ borderRadius: 8, border: '1.5px solid #d1d5db' }}
              />
              <button type="submit" className="btn btn-sm btn-primary px-4" style={{ borderRadius: 8, whiteSpace: 'nowrap' }}>
                <i className="bi bi-plus-lg me-1"></i>Add
              </button>
            </form>
          </div>

          {/* Teams List */}
          {data && teams.length > 0 && (
            <>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: 10 }}>
                {teams.length} team{teams.length !== 1 ? 's' : ''}
              </p>
              {teams.map((t) => (
                <TeamItem key={`${t.id}:${t.name}`} t={t} onDone={() => {}} />
              ))}
            </>
          )}
          {data && teams.length === 0 && (
            <div className="text-center py-5" style={{ color: '#9ca3af' }}>
              <i className="bi bi-diagram-3" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}></i>
              No teams yet. Add your first team above.
            </div>
          )}
        </div>
      </div>

      {/* Merge Duplicates Modal */}
      <Modal show={mergeOpen} onHide={() => setMergeOpen(false)} size="lg" id="mergeTeamsModal">
        <Modal.Header closeButton>
          <Modal.Title as="h5">
            <i className="bi bi-diagram-2-fill me-2" style={{ color: '#8b5cf6' }}></i>Merge Duplicate Teams
          </Modal.Title>
        </Modal.Header>
        <Modal.Body id="mergeTeamsBody">
          {!groups.length ? (
            <div className="text-center py-4">
              <i className="bi bi-check-circle-fill" style={{ color: '#10b981', fontSize: '2rem' }}></i>
              <br />
              <br />
              <strong style={{ color: '#10b981' }}>No duplicate teams found.</strong>
            </div>
          ) : (
            <>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {groups.length} duplicate group(s) found. Click <strong>Keep</strong> on the team you want to keep — all
                work plans, user records, and daily plan entries referencing the other name will be updated automatically.
              </p>
              {groups.map((group, gi) => (
                <div className="border rounded p-3 mb-3" id={`dtGroup_${gi}`} key={gi}>
                  {merged.includes(gi) ? (
                    <div className="text-center py-2" style={{ color: '#10b981' }}>
                      <i className="bi bi-check-circle-fill me-1"></i>Merged — reloading...
                    </div>
                  ) : (
                    <div className="row g-2">
                      {group.map((t) => (
                        <div className="col-md-6" key={t.id}>
                          <div className="border rounded p-3 h-100" style={{ background: '#f9fafb' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1f3a' }}>{t.name}</div>
                            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>ID #{t.id}</div>
                            <button
                              className="btn btn-sm mt-2"
                              style={{
                                border: '1px solid #10b981',
                                color: '#10b981',
                                borderRadius: 6,
                                padding: '3px 10px',
                                fontSize: '0.8rem',
                              }}
                              onClick={() => doTeamMerge(gi, t.id)}
                            >
                              <i className="bi bi-check me-1"></i>Keep this
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <small style={{ color: '#9ca3af', flex: 1 }}>Merging updates work plans, user records, and daily plan entries.</small>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMergeOpen(false)}>
            Close
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
