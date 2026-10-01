'use client';
import Link from 'next/link';
import { kindFromBg, useToastApi } from '@/context/Toast';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePageData } from '@/hooks/usePageData';
import { useAction } from '@/context/Flash';
import { apiPost } from '@/lib/api';

const css = `
/* ══ Layout ══ */
.detail-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 20px;
    align-items: start;
}
@media (max-width: 1100px) { .detail-layout { grid-template-columns: 1fr; } }

/* ══ Cards ══ */
.d-card {
    background: #fff;
    border-radius: 14px;
    border: 1.5px solid #e5e7eb;
    box-shadow: 0 2px 14px rgba(26,31,58,0.06);
    overflow: hidden;
    margin-bottom: 20px;
}
.d-card-hdr {
    padding: 13px 20px;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid #f0f2f5;
}
.d-card-hdr h3 {
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.88rem; color: #1a1f3a; margin: 0; flex: 1;
}
.d-card-hdr .hdr-icon {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.9rem; color: #fff;
}
.d-card-body { padding: 18px 20px; }

/* ══ Form controls ══ */
.fg { display: flex; flex-direction: column; gap: 5px; }
.fg label { font-size: 0.77rem; font-weight: 600; color: #374151; }
.fctrl {
    width: 100%; padding: 8px 11px;
    border: 1.5px solid #e5e7eb; border-radius: 8px;
    font-size: 0.83rem; font-family: 'DM Sans', sans-serif;
    color: #1a1f3a; background: #fff;
    transition: border-color 0.15s;
}
.fctrl:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.fg-grid {
    display: grid; gap: 12px 16px;
    grid-template-columns: repeat(3, 1fr);
}
.fg-grid .s2 { grid-column: span 2; }
.fg-grid .s3 { grid-column: span 3; }

/* ══ Update table ══ */
.upd-table { width: 100%; border-collapse: separate; border-spacing: 0; }
.upd-table th {
    background: #1a1f3a; color: rgba(255,255,255,0.8);
    font-size: 0.68rem; font-family: 'Syne', sans-serif;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    padding: 9px 12px;
}
.upd-table td {
    padding: 9px 12px; border-bottom: 1px solid #f0f2f5;
    font-size: 0.82rem; vertical-align: top;
}
.upd-table tr:last-child td { border-bottom: none; }
.upd-table tr:hover td { background: #f8faff; }
.upd-idx {
    font-size: 0.7rem; color: #9ca3af;
    font-weight: 700; text-align: center;
}
.upd-date { font-weight: 600; color: #374151; white-space: nowrap; }
.upd-remark { color: #4b5563; line-height: 1.5; }

/* ══ Email preview ══ */
.email-pre {
    background: #f8faff;
    border: 1.5px solid #e0e7ff;
    border-radius: 10px;
    padding: 14px 16px;
    font-size: 0.78rem;
    line-height: 1.7;
    white-space: pre-wrap;
    color: #374151;
    max-height: 320px;
    overflow-y: auto;
}

/* ══ Buttons ══ */
.abtn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    font-size: 0.8rem; font-weight: 600;
    cursor: pointer; border: none;
    text-decoration: none; transition: all 0.15s;
    white-space: nowrap;
}
.abtn-primary { background: #1a1f3a; color: #fff; }
.abtn-primary:hover { background: #2d3561; color: #fff; }
.abtn-teal { background: #0d9488; color: #fff; }
.abtn-teal:hover { background: #0f766e; color: #fff; }
.abtn-success { background: #059669; color: #fff; }
.abtn-success:hover { background: #047857; color: #fff; }
.abtn-outline { background: #fff; color: #374151; border: 1.5px solid #e5e7eb; }
.abtn-outline:hover { background: #f3f4f6; }
.abtn-danger { background: #fff1f2; color: #e11d48; border: 1.5px solid #fecdd3; }
.abtn-danger:hover { background: #e11d48; color: #fff; border-color: #e11d48; }
.abtn-sm { padding: 5px 9px; font-size: 0.72rem; }

/* ══ Job header banner ══ */
.job-banner {
    background: linear-gradient(135deg, #1a1f3a 0%, #2d3561 100%);
    border-radius: 14px;
    padding: 20px 24px;
    margin-bottom: 20px;
    color: #fff;
}
.job-banner h2 {
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: 1.1rem; margin: 0 0 6px; line-height: 1.3;
}
.job-banner .meta { font-size: 0.8rem; color: rgba(255,255,255,0.65); display: flex; gap: 16px; flex-wrap: wrap; }
.job-banner .meta span { display: flex; align-items: center; gap: 5px; }

/* ══ Section divider ══ */
.sec-div {
    font-family: 'Syne', sans-serif; font-weight: 700;
    font-size: 0.7rem; text-transform: uppercase;
    letter-spacing: 1px; color: #9ca3af;
    border-top: 1px solid #f0f2f5;
    padding-top: 14px; margin-top: 4px;
    grid-column: 1/-1;
}

/* ══ Add update inline form ══ */
.upd-add-form {
    display: grid;
    grid-template-columns: 160px 1fr auto;
    gap: 8px;
    padding: 14px 20px;
    background: #f8faff;
    border-top: 1px solid #e0e7ff;
    align-items: end;
}

/* ══ ISO Lightbox ══ */
#iso-lightbox {
    display: none; position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.88);
    align-items: center; justify-content: center;
    flex-direction: column;
}
#iso-lightbox.open { display: flex; }
#iso-lb-toolbar {
    position: absolute; top: 16px; right: 16px;
    display: flex; gap: 8px; z-index: 10001;
}
.lb-btn {
    background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
    color: #fff; border-radius: 8px; padding: 8px 14px;
    font-size: 1rem; cursor: pointer; transition: background .15s;
    display: flex; align-items: center; gap: 6px;
    font-family: inherit;
}
.lb-btn:hover { background: rgba(255,255,255,0.3); }
#iso-lb-zoom-level {
    color: rgba(255,255,255,0.7); font-size: 0.82rem;
    align-self: center; min-width: 46px; text-align: center;
}
#iso-lb-img-wrap {
    overflow: hidden; width: 90vw; height: 85vh;
    display: flex; align-items: center; justify-content: center;
    position: relative; cursor: grab;
}
#iso-lb-img-wrap.grabbing { cursor: grabbing; }
#iso-lb-img {
    max-width: none; max-height: none;
    transform-origin: center center;
    transition: transform .18s ease;
    user-select: none; pointer-events: none;
}
#iso-lb-hint {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.45); font-size: 0.75rem;
    pointer-events: none;
}
/* ══ Image Upload Zones ══ */
.drop-zone {
    border: 2px dashed #cbd5e1;
    border-radius: 10px;
    padding: 22px 16px;
    text-align: center;
    cursor: pointer;
    background: #f8fafc;
    transition: border-color 0.2s, background 0.2s;
    user-select: none;
}
.drop-zone:hover, .drop-zone.dragover {
    border-color: #3b82f6;
    background: #eff6ff;
}
.drop-zone.dragover { border-style: solid; }
.drop-icon {
    font-size: 1.8rem;
    color: #94a3b8;
    display: block;
    margin-bottom: 6px;
}
.drop-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 3px;
}
.drop-sub {
    font-size: 0.75rem;
    color: #9ca3af;
}
.img-preview-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
}
.img-preview-thumb {
    position: relative;
    width: 90px; height: 68px;
    border-radius: 7px;
    overflow: hidden;
    border: 1.5px solid #bfdbfe;
    background: #f0f9ff;
}
.img-preview-thumb img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
}
.img-preview-thumb .rm-btn {
    position: absolute; top: 2px; right: 2px;
    background: rgba(220,38,38,0.85); color: #fff;
    border: none; border-radius: 50%;
    width: 18px; height: 18px;
    font-size: 11px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
}
.img-del-btn {
    background: rgba(220,38,38,0.85); color: #fff;
    border: none; border-radius: 50%;
    width: 22px; height: 22px; font-size: 12px;
    cursor: pointer; display: flex;
    align-items: center; justify-content: center;
}
`;

type Side = 'left' | 'iso';

function PendingPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="img-preview-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" />
      <button type="button" className="rm-btn" onClick={onRemove}>
        &#x2715;
      </button>
    </div>
  );
}

export default function MasterSetDetailPage() {
  const params = useParams();
  const idParam = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const { data } = usePageData(`/api/pages/master-set/${idParam}`);
  const run = useAction();

  // ── pending uploads ──
  const [pending, setPending] = useState<Record<Side, File[]>>({ left: [], iso: [] });
  const [dragover, setDragover] = useState<Record<Side, boolean>>({ left: false, iso: false });
  const leftInputRef = useRef<HTMLInputElement>(null);
  const isoInputRef = useRef<HTMLInputElement>(null);
  const lastFocusedZone = useRef<Side>('left');

  // ── toasts ──
  const toastApi = useToastApi();

  // ── lightbox ──
  const [lbOpen, setLbOpen] = useState(false);
  const [lbSrc, setLbSrc] = useState('');
  const [lbGallery, setLbGallery] = useState<string[]>([]);
  const [lbCurrent, setLbCurrent] = useState(0);
  const [lbScale, setLbScale] = useState(1);
  const [lbX, setLbX] = useState(0);
  const [lbY, setLbY] = useState(0);
  const [lbGrabbing, setLbGrabbing] = useState(false);
  const lbDragging = useRef(false);
  const lbLast = useRef({ x: 0, y: 0 });
  const touchDist = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const showPathToast = (msg: string, bg?: string) => toastApi.show(kindFromBg(bg), msg);
  const showPasteToast = (label: string) => toastApi.info(`Image pasted → ${label}`);

  const openMsFolder = async (path: string) => {
    const copy = (failMsg: string) => {
      navigator.clipboard
        .writeText(path)
        .then(() => showPathToast('Path copied to clipboard', '#059669'))
        .catch(() => showPathToast(failMsg, '#e11d48'));
    };
    const d = await apiPost('/api/actions/open-folder', { path });
    if (d.status === 0) {
      copy('Could not open folder');
    } else if (!d.ok) {
      copy('Could not open path — drive may be inaccessible');
    }
  };

  // ── pending files ──
  const addFiles = useCallback((side: Side, files: File[]) => {
    setPending((p) => {
      if (side === 'iso') return { ...p, iso: files.length > 0 ? [files[0]] : [] };
      return { ...p, left: [...p.left, ...files] };
    });
  }, []);

  const clearPending = (side: Side) => {
    setPending((p) => ({ ...p, [side]: [] }));
    const inp = side === 'left' ? leftInputRef.current : isoInputRef.current;
    if (inp) inp.value = '';
  };

  const removePending = (side: Side, idx: number) => {
    setPending((p) => ({ ...p, [side]: p[side].filter((_, i) => i !== idx) }));
  };

  // global paste
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;
      e.preventDefault();
      const side = lastFocusedZone.current;
      setDragover((d) => ({ ...d, [side]: true }));
      setTimeout(() => setDragover((d) => ({ ...d, [side]: false })), 400);
      addFiles(side, imageFiles);
      showPasteToast(side === 'iso' ? 'ISO' : 'Left Panel');
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [addFiles]);

  // ── lightbox helpers ──
  const openLightbox = (src: string, gallery: string[], idx: number) => {
    setLbGallery(gallery || []);
    setLbCurrent(idx || 0);
    setLbScale(1);
    setLbX(0);
    setLbY(0);
    setLbSrc(src);
    setLbOpen(true);
    document.body.style.overflow = 'hidden';
  };
  const closeLightbox = useCallback(() => {
    setLbOpen(false);
    document.body.style.overflow = '';
  }, []);
  const lbResetView = () => {
    setLbScale(1);
    setLbX(0);
    setLbY(0);
  };
  const lbPrev = useCallback(() => {
    if (!lbGallery.length) return;
    const n = (lbCurrent - 1 + lbGallery.length) % lbGallery.length;
    setLbCurrent(n);
    setLbSrc(lbGallery[n]);
    setLbScale(1);
    setLbX(0);
    setLbY(0);
  }, [lbGallery, lbCurrent]);
  const lbNext = useCallback(() => {
    if (!lbGallery.length) return;
    const n = (lbCurrent + 1) % lbGallery.length;
    setLbCurrent(n);
    setLbSrc(lbGallery[n]);
    setLbScale(1);
    setLbX(0);
    setLbY(0);
  }, [lbGallery, lbCurrent]);
  const lbZoom = useCallback((delta: number) => {
    setLbScale((s) => Math.min(Math.max(s + delta, 0.25), 6));
  }, []);

  // wheel zoom (non-passive so preventDefault works)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lbZoom(e.deltaY < 0 ? 0.15 : -0.15);
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [lbZoom, data]);

  // drag to pan
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!lbDragging.current) return;
      const dx = e.clientX - lbLast.current.x;
      const dy = e.clientY - lbLast.current.y;
      setLbX((x) => x + dx);
      setLbY((y) => y + dy);
      lbLast.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      lbDragging.current = false;
      setLbGrabbing(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ESC / arrow keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lbPrev();
      if (e.key === 'ArrowRight') lbNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeLightbox, lbPrev, lbNext]);

  useEffect(
    () => () => {
      document.body.style.overflow = '';
    },
    []
  );

  if (!data) return null;

  const rec: any = data.rec;
  const updates: any[] = data.updates || [];
  const left_images: any[] = data.left_images || [];
  const iso_image: any = data.iso_image || null;
  const projects: string[] = data.projects || [];
  const clients: string[] = data.clients || [];
  const teams: string[] = data.teams || [];
  const checkers: string[] = data.checkers || [];
  const today: string = data.today || '';
  const msId = rec.id;

  const imgUrl = (imgId: number) => `/api/actions/master-set/${msId}/image/${imgId}`;
  const ISO_SRC = iso_image ? imgUrl(iso_image.id) : '';
  const leftImages = left_images.map((i) => imgUrl(i.id));
  const act = (suffix: string) => `/api/actions/master-set/${msId}/${suffix}`;

  const onEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await run('POST', act('edit'), new FormData(e.currentTarget));
  };
  const onAddUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await run('POST', act('add-update'), new FormData(form));
    if (res.ok) form.reset();
  };
  const onDeleteUpdate = async (e: FormEvent<HTMLFormElement>, updId: number) => {
    e.preventDefault();
    if (!confirm('Remove this update row?')) return;
    await run('POST', act(`delete-update/${updId}`));
  };
  const onDeleteImage = async (e: FormEvent<HTMLFormElement>, imgId: number, msg: string) => {
    e.preventDefault();
    if (!confirm(msg)) return;
    await run('POST', act(`delete-image/${imgId}`));
  };
  const onDeleteMs = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confirm('Permanently delete this Project Master Set? This cannot be undone.')) return;
    await run('POST', act('delete'));
  };
  const onUpload = async (e: FormEvent<HTMLFormElement>, side: Side) => {
    e.preventDefault();
    const fd = new FormData();
    const field = side === 'left' ? 'left_images' : 'iso_image';
    pending[side].forEach((f) => fd.append(field, f, f.name));
    const res = await run('POST', act(side === 'left' ? 'upload-left' : 'upload-iso'), fd);
    if (res.ok !== false) clearPending(side);
  };

  const zoneProps = (side: Side, inputRef: React.RefObject<HTMLInputElement | null>) => ({
    onClick: () => inputRef.current?.click(),
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragover((d) => ({ ...d, [side]: true }));
    },
    onDragLeave: () => setDragover((d) => ({ ...d, [side]: false })),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragover((d) => ({ ...d, [side]: false }));
      if (e.dataTransfer.files.length) addFiles(side, Array.from(e.dataTransfer.files));
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
    },
    onFocus: () => {
      lastFocusedZone.current = side;
    },
    onMouseEnter: () => {
      lastFocusedZone.current = side;
    },
  });

  const multi = lbGallery.length > 1;
  const emailLines = rec.email_body ? String(rec.email_body).split('\n').length : 0;

  return (
    <>
      <style>{css}</style>

      {/* Back + action bar */}
      <div className="d-flex align-items-center gap-3 mb-3">
        <Link href="/ownership-log" className="abtn abtn-outline">
          <i className="bi bi-arrow-left"></i> Back
        </Link>
        <a href={act('export')} className="abtn abtn-success ms-auto">
          <i className="bi bi-file-earmark-excel"></i> Download Excel
        </a>
      </div>

      {/* Job banner */}
      <div className="job-banner">
        <h2>{rec.job_name}</h2>
        <div className="meta">
          {rec.client && (
            <span>
              <i className="bi bi-person-badge"></i> {rec.client}
            </span>
          )}
          {rec.team && (
            <span>
              <i className="bi bi-people-fill"></i> {rec.team}
            </span>
          )}
          {rec.received_date && (
            <span>
              <i className="bi bi-calendar3"></i> Received {rec.received_date}
            </span>
          )}
          {rec.working_days && (
            <span>
              <i className="bi bi-clock"></i> {rec.working_days} working days
            </span>
          )}
          <span>
            <i className="bi bi-person"></i> {rec.submitted_by}
          </span>
          {rec.folder_path && (
            <span>
              <button
                type="button"
                onClick={() => openMsFolder(rec.folder_path)}
                title={rec.folder_path}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  transition: 'background .15s',
                }}
              >
                <i className="bi bi-folder2-open"></i>
                <span
                  style={{
                    maxWidth: 220,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                  }}
                >
                  {rec.folder_path}
                </span>
              </button>
            </span>
          )}
        </div>
      </div>

      <div className="detail-layout">
        {/* ══ LEFT COLUMN ══ */}
        <div>
          {/* Edit core details */}
          <div className="d-card">
            <div className="d-card-hdr">
              <span className="hdr-icon" style={{ background: '#1a1f3a' }}>
                <i className="bi bi-pencil-fill"></i>
              </span>
              <h3>Edit Job Details</h3>
            </div>
            <form key={JSON.stringify(rec)} onSubmit={onEdit}>
              <div className="d-card-body">
                <div className="fg-grid">
                  <div className="fg s2">
                    <label>Job Name *</label>
                    <input
                      type="text"
                      name="job_name"
                      className="fctrl"
                      defaultValue={rec.job_name ?? ''}
                      list="jobList"
                      required
                      autoComplete="off"
                    />
                    <datalist id="jobList">
                      {projects.map((p, i) => (
                        <option key={i} value={p} />
                      ))}
                    </datalist>
                  </div>
                  <div className="fg">
                    <label>Client</label>
                    <input
                      type="text"
                      name="client"
                      className="fctrl"
                      defaultValue={rec.client || ''}
                      list="clientList"
                      autoComplete="off"
                    />
                    <datalist id="clientList">
                      {clients.map((c, i) => (
                        <option key={i} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="fg">
                    <label>Team</label>
                    <input
                      type="text"
                      name="team"
                      className="fctrl"
                      defaultValue={rec.team || ''}
                      list="teamList"
                      autoComplete="off"
                    />
                    <datalist id="teamList">
                      {teams.map((t, i) => (
                        <option key={i} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div className="fg">
                    <label>QC Checker</label>
                    <input
                      type="text"
                      name="qc_checker"
                      className="fctrl"
                      defaultValue={rec.qc_checker || ''}
                      list="checkerList"
                      autoComplete="off"
                    />
                    <datalist id="checkerList">
                      {checkers.map((c, i) => (
                        <option key={i} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="fg">
                    <label>Received Date</label>
                    <input
                      type="date"
                      name="received_date"
                      className="fctrl"
                      defaultValue={rec.received_date || today}
                    />
                  </div>
                  <div className="fg">
                    <label>Working Days</label>
                    <input
                      type="number"
                      name="working_days"
                      className="fctrl"
                      defaultValue={rec.working_days || ''}
                      min="1"
                      placeholder="e.g. 2"
                    />
                  </div>
                  <div className="fg"></div>

                  <div className="sec-div">Folder Path</div>
                  <div className="fg s3">
                    <label>
                      Folder Path{' '}
                      <span style={{ fontWeight: 400, color: '#9ca3af' }}>
                        — click the path in the banner to open in Explorer
                      </span>
                    </label>
                    <input
                      type="text"
                      name="folder_path"
                      className="fctrl"
                      defaultValue={rec.folder_path || ''}
                      placeholder="e.g. \\SERVER\Projects\JobName or D:\Projects\JobName"
                    />
                  </div>

                  <div className="sec-div">Email Body</div>
                  <div className="fg s3">
                    <label>
                      Paste email content{' '}
                      <span style={{ fontWeight: 400, color: '#9ca3af' }}>— shows in Excel below the update table</span>
                    </label>
                    <textarea
                      name="email_body"
                      className="fctrl"
                      rows={8}
                      style={{ resize: 'vertical' }}
                      defaultValue={rec.email_body || ''}
                    ></textarea>
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid #f0f2f5',
                  background: '#fafbfc',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <button type="submit" className="abtn abtn-primary">
                  <i className="bi bi-check-lg"></i> Save Changes
                </button>
                <button type="reset" className="abtn abtn-outline">
                  Reset
                </button>
              </div>
            </form>
          </div>

          {/* Email preview (read-only) */}
          {rec.email_body && (
            <div className="d-card">
              <div className="d-card-hdr">
                <span className="hdr-icon" style={{ background: '#3b82f6' }}>
                  <i className="bi bi-envelope-fill"></i>
                </span>
                <h3>Email Preview</h3>
              </div>
              <div className="d-card-body">
                <pre className="email-pre">{rec.email_body}</pre>
              </div>
            </div>
          )}

          {/* Left images upload */}
          <div className="d-card">
            <div className="d-card-hdr">
              <span className="hdr-icon" style={{ background: '#0ea5e9' }}>
                <i className="bi bi-images"></i>
              </span>
              <h3>Left Panel Images</h3>
              <span
                id="left-count-badge"
                style={{
                  background: '#e0f2fe',
                  color: '#0369a1',
                  borderRadius: 12,
                  padding: '2px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {left_images.length} image(s)
              </span>
            </div>
            <div className="d-card-body">
              {/* Existing saved images */}
              {left_images.length > 0 && (
                <div
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}
                  id="left-saved-imgs"
                >
                  {left_images.map((img, idx) => (
                    <div
                      key={img.id}
                      style={{
                        position: 'relative',
                        border: '1.5px solid #e5e7eb',
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: '#f9fafb',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl(img.id)}
                        style={{
                          width: 110,
                          height: 82,
                          objectFit: 'cover',
                          display: 'block',
                          cursor: 'zoom-in',
                        }}
                        onClick={() => leftImages.length && openLightbox(leftImages[idx], leftImages, idx)}
                        title="Click to enlarge"
                        alt=""
                      />
                      <form
                        style={{ position: 'absolute', top: 3, right: 3 }}
                        onSubmit={(e) => onDeleteImage(e, img.id, 'Remove this image?')}
                      >
                        <button type="submit" className="img-del-btn">
                          <i className="bi bi-x"></i>
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone */}
              <form id="left-upload-form" onSubmit={(e) => onUpload(e, 'left')}>
                <input
                  type="file"
                  id="left-file-input"
                  name="left_images"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  ref={leftInputRef}
                  onChange={(e) => {
                    const inp = e.currentTarget;
                    if (inp.files && inp.files.length) addFiles('left', Array.from(inp.files));
                    inp.value = '';
                  }}
                />
                <div
                  className={'drop-zone' + (dragover.left ? ' dragover' : '')}
                  id="left-drop-zone"
                  tabIndex={0}
                  {...zoneProps('left', leftInputRef)}
                >
                  <i className="bi bi-cloud-arrow-up drop-icon"></i>
                  <div className="drop-title">Drop images here</div>
                  <div className="drop-sub">or click to browse · paste (Ctrl+V) also works</div>
                </div>
                {/* Preview area for pending uploads */}
                <div
                  id="left-preview"
                  className="img-preview-row"
                  style={{ display: pending.left.length ? 'flex' : 'none' }}
                >
                  {pending.left.map((f, idx) => (
                    <PendingPreview key={idx + f.name + f.size + f.lastModified} file={f} onRemove={() => removePending('left', idx)} />
                  ))}
                </div>
                <div
                  id="left-actions"
                  style={{ marginTop: 10, gap: 8, display: pending.left.length ? 'flex' : 'none' }}
                >
                  <button type="submit" className="abtn abtn-primary abtn-sm" id="left-upload-btn">
                    <i className="bi bi-upload"></i> Upload{' '}
                    <span id="left-upload-count">{pending.left.length ? `(${pending.left.length})` : ''}</span>
                  </button>
                  <button type="button" className="abtn abtn-outline abtn-sm" onClick={() => clearPending('left')}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /left */}

        {/* ══ RIGHT COLUMN ══ */}
        <div>
          {/* Update log */}
          <div className="d-card">
            <div className="d-card-hdr">
              <span className="hdr-icon" style={{ background: '#7c3aed' }}>
                <i className="bi bi-journal-text"></i>
              </span>
              <h3>Date / Remark Updates</h3>
              <span
                style={{
                  background: '#ede9fe',
                  color: '#5b21b6',
                  borderRadius: 12,
                  padding: '2px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {updates.length} rows
              </span>
            </div>

            {updates.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="upd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>#</th>
                      <th>Date</th>
                      <th>Remark</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {updates.map((upd, i) => (
                      <tr key={upd.id}>
                        <td className="upd-idx">{i + 1}</td>
                        <td className="upd-date">{upd.upd_date}</td>
                        <td className="upd-remark">{upd.remark}</td>
                        <td>
                          <form style={{ margin: 0 }} onSubmit={(e) => onDeleteUpdate(e, upd.id)}>
                            <button type="submit" className="abtn abtn-danger abtn-sm">
                              <i className="bi bi-trash-fill"></i>
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>
                <i className="bi bi-journal-x" style={{ display: 'block', fontSize: '1.8rem', marginBottom: 8 }}></i>
                No updates yet. Add one below.
              </div>
            )}

            {/* Add update row */}
            <form onSubmit={onAddUpdate}>
              <div className="upd-add-form">
                <div className="fg">
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>Date</label>
                  <input type="date" name="update_date" className="fctrl" defaultValue={today} required />
                </div>
                <div className="fg">
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>Remark</label>
                  <input type="text" name="update_remark" className="fctrl" placeholder="Enter remark…" required />
                </div>
                <div>
                  <button type="submit" className="abtn abtn-teal">
                    <i className="bi bi-plus-lg"></i> Add
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* ISO View image upload */}
          <div className="d-card">
            <div className="d-card-hdr">
              <span className="hdr-icon" style={{ background: '#ef4444' }}>
                <i className="bi bi-box-seam"></i>
              </span>
              <h3>ISO View Image</h3>
              {iso_image && (
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    borderRadius: 12,
                    padding: '2px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  Uploaded
                </span>
              )}
            </div>
            <div className="d-card-body">
              {iso_image && (
                <>
                  <div
                    style={{
                      marginBottom: 10,
                      border: '1.5px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#f9fafb',
                      cursor: 'zoom-in',
                      position: 'relative',
                    }}
                    onClick={() => ISO_SRC && openLightbox(ISO_SRC, [], 0)}
                    title="Click to enlarge"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ISO_SRC}
                      style={{
                        maxWidth: '100%',
                        maxHeight: 170,
                        display: 'block',
                        objectFit: 'contain',
                        margin: '0 auto',
                      }}
                      id="iso-thumb"
                      alt=""
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        right: 8,
                        background: 'rgba(0,0,0,0.45)',
                        color: '#fff',
                        borderRadius: 5,
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      <i className="bi bi-zoom-in"></i> Click to zoom
                    </div>
                  </div>
                  <form
                    onSubmit={(e) => onDeleteImage(e, iso_image.id, 'Remove ISO image?')}
                    style={{ marginBottom: 12 }}
                  >
                    <button type="submit" className="abtn abtn-danger abtn-sm">
                      <i className="bi bi-trash"></i> Remove
                    </button>
                  </form>
                </>
              )}

              <form id="iso-upload-form" onSubmit={(e) => onUpload(e, 'iso')}>
                <input
                  type="file"
                  id="iso-file-input"
                  name="iso_image"
                  accept="image/*"
                  style={{ display: 'none' }}
                  ref={isoInputRef}
                  onChange={(e) => {
                    const inp = e.currentTarget;
                    if (inp.files && inp.files.length) addFiles('iso', Array.from(inp.files));
                    inp.value = '';
                  }}
                />
                <div
                  className={'drop-zone' + (dragover.iso ? ' dragover' : '')}
                  id="iso-drop-zone"
                  tabIndex={0}
                  {...zoneProps('iso', isoInputRef)}
                >
                  <i className="bi bi-camera drop-icon" style={{ color: '#ef4444' }}></i>
                  <div className="drop-title">{rec.iso_image ? 'Replace ISO image' : 'Upload ISO image'}</div>
                  <div className="drop-sub">drop · click · paste (Ctrl+V)</div>
                </div>
                <div
                  id="iso-preview"
                  className="img-preview-row"
                  style={{ display: pending.iso.length ? 'flex' : 'none' }}
                >
                  {pending.iso.map((f, idx) => (
                    <PendingPreview key={idx + f.name + f.size + f.lastModified} file={f} onRemove={() => removePending('iso', idx)} />
                  ))}
                </div>
                <div id="iso-actions" style={{ marginTop: 10, gap: 8, display: pending.iso.length ? 'flex' : 'none' }}>
                  <button type="submit" className="abtn abtn-primary abtn-sm">
                    <i className="bi bi-upload"></i> Upload ISO
                  </button>
                  <button type="button" className="abtn abtn-outline abtn-sm" onClick={() => clearPending('iso')}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Quick stats */}
          <div className="d-card">
            <div className="d-card-hdr">
              <span className="hdr-icon" style={{ background: '#f59e0b' }}>
                <i className="bi bi-info-circle-fill"></i>
              </span>
              <h3>Summary</h3>
            </div>
            <div className="d-card-body">
              <table style={{ width: '100%', fontSize: '0.82rem' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#6b7280', padding: '5px 0' }}>Project Master Set ID</td>
                    <td style={{ fontWeight: 600, color: '#1a1f3a' }}>#{rec.id}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6b7280', padding: '5px 0' }}>Created</td>
                    <td style={{ fontWeight: 600, color: '#1a1f3a' }}>{rec.created_at}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6b7280', padding: '5px 0' }}>Update rows in Excel</td>
                    <td style={{ fontWeight: 600, color: '#7c3aed' }}>
                      {updates.length} rows (+ {Math.max(8 - updates.length, 0)} blank rows)
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6b7280', padding: '5px 0' }}>Email lines</td>
                    <td style={{ fontWeight: 600, color: '#1a1f3a' }}>{emailLines}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Danger zone */}
          <div className="d-card" style={{ borderColor: '#fecdd3' }}>
            <div className="d-card-hdr" style={{ background: '#fff1f2' }}>
              <span className="hdr-icon" style={{ background: '#e11d48' }}>
                <i className="bi bi-exclamation-triangle-fill"></i>
              </span>
              <h3 style={{ color: '#e11d48' }}>Danger Zone</h3>
            </div>
            <div className="d-card-body">
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 12 }}>
                Permanently delete this Project Master Set and all its update rows.
              </p>
              <form onSubmit={onDeleteMs}>
                <button type="submit" className="abtn abtn-danger">
                  <i className="bi bi-trash-fill"></i> Delete Project Master Set
                </button>
              </form>
            </div>
          </div>
        </div>
        {/* /right */}
      </div>
      {/* /detail-layout */}

      {/* ══ ISO Lightbox ══ */}
      <div
        id="iso-lightbox"
        className={lbOpen ? 'open' : ''}
        onClick={(e) => {
          const id = (e.target as HTMLElement).id;
          if (id === 'iso-lightbox' || id === 'iso-lb-img-wrap') closeLightbox();
        }}
      >
        <div id="iso-lb-toolbar" onClick={(e) => e.stopPropagation()}>
          <button
            className="lb-btn lb-nav-btn"
            id="lb-prev-btn"
            onClick={lbPrev}
            title="Previous"
            style={{ display: multi ? '' : 'none' }}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <span
            id="lb-img-counter"
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.82rem',
              alignSelf: 'center',
              minWidth: 52,
              textAlign: 'center',
              display: multi ? '' : 'none',
            }}
          >
            {multi ? `${lbCurrent + 1} / ${lbGallery.length}` : ''}
          </span>
          <button
            className="lb-btn lb-nav-btn"
            id="lb-next-btn"
            onClick={lbNext}
            title="Next"
            style={{ display: multi ? '' : 'none' }}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
          <span id="iso-lb-zoom-level">{Math.round(lbScale * 100) + '%'}</span>
          <button className="lb-btn" onClick={() => lbZoom(0.25)} title="Zoom In">
            <i className="bi bi-zoom-in"></i>
          </button>
          <button className="lb-btn" onClick={() => lbZoom(-0.25)} title="Zoom Out">
            <i className="bi bi-zoom-out"></i>
          </button>
          <button className="lb-btn" onClick={lbResetView} title="Reset">
            <i className="bi bi-aspect-ratio"></i>
          </button>
          <button className="lb-btn" onClick={closeLightbox} title="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div
          id="iso-lb-img-wrap"
          ref={wrapRef}
          className={lbGrabbing ? 'grabbing' : ''}
          onMouseDown={(e) => {
            lbDragging.current = true;
            lbLast.current = { x: e.clientX, y: e.clientY };
            setLbGrabbing(true);
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              touchDist.current = Math.hypot(dx, dy);
            } else if (e.touches.length === 1) {
              lbLast.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.hypot(dx, dy);
              const ratio = dist / touchDist.current;
              setLbScale((s) => Math.min(Math.max(s * ratio, 0.25), 6));
              touchDist.current = dist;
            } else if (e.touches.length === 1) {
              const cx = e.touches[0].clientX;
              const cy = e.touches[0].clientY;
              const dx = cx - lbLast.current.x;
              const dy = cy - lbLast.current.y;
              setLbX((x) => x + dx);
              setLbY((y) => y + dy);
              lbLast.current = { x: cx, y: cy };
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            id="iso-lb-img"
            src={lbSrc || undefined}
            alt="ISO View"
            style={{ transform: `translate(${lbX}px, ${lbY}px) scale(${lbScale})` }}
          />
        </div>
        <div id="iso-lb-hint">Scroll to zoom &middot; Drag to pan &middot; Click outside or ESC to close</div>
      </div>

    </>
  );
}
