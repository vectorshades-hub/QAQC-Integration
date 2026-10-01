'use client';
import { useEffect, useRef, useState } from 'react';
import { usePageData } from '@/hooks/usePageData';
import { useAction } from '@/context/Flash';

const css = `
.panel-card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; }
.panel-header {
    padding:14px 18px; font-family:'Syne',sans-serif; font-weight:700;
    font-size:.9rem; display:flex; align-items:center; justify-content:space-between;
}
.panel-header.clients  { background:linear-gradient(135deg,#1e40af,#3b82f6); color:#fff; }
.panel-header.projects { background:linear-gradient(135deg,#065f46,#10b981); color:#fff; }
.panel-count { background:rgba(255,255,255,.25); border-radius:20px; padding:2px 10px; font-size:.75rem; }
.item-row {
    display:flex; align-items:center; gap:10px;
    padding:9px 16px; border-bottom:1px solid #f0f0f0; transition:background .12s;
}
.item-row:hover { background:#f8faff; }
.item-row:last-child { border-bottom:none; }
.item-name { flex:1; font-size:.88rem; font-weight:500; color:#1a1f3a; word-break:break-word; }
.add-form {
    padding:12px 16px; border-top:2px solid #e5e7eb; background:#fafafa;
    display:flex; gap:8px; align-items:center;
}
.add-form input { flex:1; border:1px solid #e5e7eb; border-radius:8px;
    padding:7px 12px; font-size:.85rem; outline:none; }
.add-form input:focus { border-color:#3b82f6; }
.action-btn { background:none; border:none; cursor:pointer; padding:4px 7px;
    border-radius:6px; font-size:.78rem; transition:all .12s;
    display:flex; align-items:center; gap:3px; }
.btn-edit { color:#3b82f6; border:1px solid #bfdbfe; }
.btn-edit:hover { background:#eff6ff; }
.btn-del  { color:#ef4444; border:1px solid #fecaca; }
.btn-del:hover  { background:#fee2e2; }
.empty-msg { padding:24px; text-align:center; color:#9ca3af; font-size:.85rem; }
.inline-edit { display:none; flex:1; }
.inline-edit input { border:1px solid #3b82f6; border-radius:6px; padding:4px 8px;
    font-size:.85rem; width:100%; outline:none; }
.editing .item-name   { display:none; }
.editing .inline-edit { display:flex; gap:6px; align-items:center; }
.editing .btn-edit    { display:none; }
`;

type Item = { id: number; name: string };

function ItemRow({
  item,
  prefix,
  kind,
  saveColor,
  hidden,
  extraClass,
}: {
  item: Item;
  prefix: 'cr' | 'pr';
  kind: 'client' | 'project';
  saveColor: string;
  hidden?: boolean;
  extraClass?: string;
}) {
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
    await run('POST', `/api/actions/projects/${kind}/edit/${item.id}`, new FormData(e.currentTarget));
    setEditing(false);
  }
  async function onDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirm(`Remove ${item.name}?`)) return;
    await run('POST', `/api/actions/projects/${kind}/delete/${item.id}`);
  }

  return (
    <div
      className={`item-row${extraClass ? ' ' + extraClass : ''}${editing ? ' editing' : ''}`}
      id={`${prefix}-${item.id}`}
      style={hidden ? { display: 'none' } : undefined}
    >
      <span className="item-name">{item.name}</span>
      <div className="inline-edit">
        <form method="POST" onSubmit={onSave} style={{ display: 'flex', gap: 6, flex: 1 }}>
          <input type="text" name="name" defaultValue={item.name} ref={inputRef} required />
          <button
            type="submit"
            className="action-btn"
            style={{ background: saveColor, color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: '.8rem' }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="action-btn"
            style={{ border: '1px solid #e5e7eb', color: '#6b7280' }}
          >
            Cancel
          </button>
        </form>
      </div>
      <button className="action-btn btn-edit" onClick={() => setEditing(true)} title="Edit">
        <i className="bi bi-pencil"></i>
      </button>
      <form method="POST" style={{ display: 'inline' }} onSubmit={onDelete}>
        <button type="submit" className="action-btn btn-del" title="Remove">
          <i className="bi bi-trash3"></i>
        </button>
      </form>
    </div>
  );
}

export default function ProjectsPage() {
  const run = useAction();
  const { data } = usePageData<{ clients: Item[]; projects: Item[] }>('/api/pages/projects');
  const clients = data?.clients || [];
  const projects = data?.projects || [];
  const [q, setQ] = useState('');
  const fq = q.toLowerCase().trim();

  async function onAdd(e: React.FormEvent<HTMLFormElement>, path: string) {
    e.preventDefault();
    const form = e.currentTarget;
    await run('POST', path, new FormData(form));
    form.reset();
  }

  return (
    <>
      <style>{css}</style>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="bi bi-folder2-open me-2" style={{ color: '#3b82f6' }}></i>Projects &amp; Clients
          </h1>
          <p className="page-subtitle">Manage the client and project lists used across all forms</p>
        </div>
      </div>

      {data && (
        <div className="row g-4">
          {/* CLIENTS */}
          <div className="col-md-6">
            <div className="panel-card">
              <div className="panel-header clients">
                <span>
                  <i className="bi bi-building me-2"></i>Clients
                </span>
                <span className="panel-count">{clients.length}</span>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {clients.length ? (
                  clients.map((cl) => (
                    <ItemRow key={`${cl.id}:${cl.name}`} item={cl} prefix="cr" kind="client" saveColor="#3b82f6" />
                  ))
                ) : (
                  <div className="empty-msg">
                    <i className="bi bi-building" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 6, opacity: 0.3 }}></i>
                    No clients yet
                  </div>
                )}
              </div>
              <form method="POST" onSubmit={(e) => onAdd(e, '/api/actions/projects/client/add')} className="add-form">
                <input type="text" name="name" placeholder="New client name…" required autoComplete="off" />
                <button
                  type="submit"
                  className="btn btn-sm"
                  style={{
                    background: '#1e40af',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '7px 16px',
                    border: 'none',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <i className="bi bi-plus-lg me-1"></i>Add
                </button>
              </form>
            </div>
          </div>

          {/* PROJECTS */}
          <div className="col-md-6">
            <div className="panel-card">
              <div className="panel-header projects">
                <span>
                  <i className="bi bi-clipboard2-check me-2"></i>Projects
                </span>
                <span className="panel-count">{projects.length}</span>
              </div>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0' }}>
                <input
                  type="text"
                  id="projectSearch"
                  placeholder="Search projects…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: '.85rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }} id="projectList">
                {projects.length ? (
                  projects.map((p) => (
                    <ItemRow
                      key={`${p.id}:${p.name}`}
                      item={p}
                      prefix="pr"
                      kind="project"
                      saveColor="#10b981"
                      extraClass="proj-row"
                      hidden={!!fq && !p.name.toLowerCase().includes(fq)}
                    />
                  ))
                ) : (
                  <div className="empty-msg" id="emptyProjects">
                    <i className="bi bi-clipboard2" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 6, opacity: 0.3 }}></i>
                    No projects yet
                  </div>
                )}
              </div>
              <form method="POST" onSubmit={(e) => onAdd(e, '/api/actions/projects/project/add')} className="add-form">
                <input type="text" name="name" placeholder="New project name…" required autoComplete="off" />
                <button
                  type="submit"
                  className="btn btn-sm"
                  style={{
                    background: '#065f46',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '7px 16px',
                    border: 'none',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <i className="bi bi-plus-lg me-1"></i>Add
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
