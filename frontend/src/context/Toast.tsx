'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: ReactNode; title?: string; duration: number; leaving: boolean };

type Api = {
  show: (kind: ToastKind, message: ReactNode, opts?: { title?: string; duration?: number }) => void;
  success: (message: ReactNode, title?: string) => void;
  error: (message: ReactNode, title?: string) => void;
  warning: (message: ReactNode, title?: string) => void;
  info: (message: ReactNode, title?: string) => void;
};

const noop = () => {};
const ToastContext = createContext<Api>({ show: noop, success: noop, error: noop, warning: noop, info: noop });

const KINDS: Record<ToastKind, { icon: string; color: string; title: string }> = {
  success: { icon: 'bi-check-circle-fill', color: '#10b981', title: 'Success' },
  error: { icon: 'bi-x-circle-fill', color: '#ef4444', title: 'Error' },
  warning: { icon: 'bi-exclamation-triangle-fill', color: '#f59e0b', title: 'Warning' },
  info: { icon: 'bi-info-circle-fill', color: '#3b82f6', title: 'Info' },
};

/** Legacy per-page toasts passed a background colour; map it to a kind. */
export function kindFromBg(bg?: string): ToastKind {
  if (bg === '#e11d48') return 'error';
  if (bg === '#059669') return 'success';
  return 'info';
}

/** Flask flash categories (success/danger/warning/info) -> toast kinds */
export function kindFromCategory(category: string): ToastKind {
  if (category === 'danger' || category === 'error') return 'error';
  if (category === 'success' || category === 'warning') return category;
  return 'info';
}

const css = `
.tt-stack {
    position: fixed; top: 72px; right: 20px; z-index: 11000;
    display: flex; flex-direction: column; gap: 10px;
    width: 360px; max-width: calc(100vw - 32px); pointer-events: none;
}
.tt-toast {
    position: relative; overflow: hidden; pointer-events: auto;
    display: flex; align-items: flex-start; gap: 12px;
    background: #fff; border: 1px solid #e5e7eb; border-left: 4px solid var(--tt-color);
    border-radius: 12px; padding: 12px 14px;
    box-shadow: 0 10px 30px rgba(17,24,39,.14), 0 2px 6px rgba(17,24,39,.06);
    animation: ttIn .32s cubic-bezier(.21,1.02,.73,1) both;
}
.tt-toast.leaving { animation: ttOut .22s ease-in both; }
.tt-icon { font-size: 1.25rem; color: var(--tt-color); line-height: 1; margin-top: 1px; }
.tt-body { flex: 1; min-width: 0; }
.tt-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: .85rem; color: #1a1f3a; line-height: 1.2; }
.tt-msg { font-size: .83rem; color: #4b5563; margin-top: 2px; word-break: break-word; }
.tt-close { background: none; border: none; color: #9ca3af; cursor: pointer; padding: 2px; font-size: .8rem; line-height: 1; }
.tt-close:hover { color: #1a1f3a; }
.tt-bar { position: absolute; left: 0; bottom: 0; height: 3px; background: var(--tt-color); opacity: .55; animation: ttBar linear both; }
.tt-toast:hover .tt-bar { animation-play-state: paused; }
@keyframes ttIn { from { opacity: 0; transform: translateX(28px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes ttOut { to { opacity: 0; transform: translateX(28px) scale(.96); } }
@keyframes ttBar { from { width: 100%; } to { width: 0; } }
@media (max-width: 480px) { .tt-stack { right: 16px; left: 16px; width: auto; top: 64px; } }
`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, any>>(new Map());

  const remove = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((l) => l.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 220);
  }, []);

  const show = useCallback<Api['show']>(
    (kind, message, opts) => {
      const id = nextId.current++;
      const duration = opts?.duration ?? (kind === 'error' ? 6000 : 4000);
      setItems((l) => [...l.slice(-4), { id, kind, message, title: opts?.title, duration, leaving: false }]);
      timers.current.set(id, setTimeout(() => remove(id), duration));
    },
    [remove]
  );

  const api = useMemo<Api>(
    () => ({
      show,
      success: (m, title) => show('success', m, { title }),
      error: (m, title) => show('error', m, { title }),
      warning: (m, title) => show('warning', m, { title }),
      info: (m, title) => show('info', m, { title }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <style>{css}</style>
      <div className="tt-stack" aria-live="polite">
        {items.map((t) => {
          const k = KINDS[t.kind];
          return (
            <div key={t.id} className={'tt-toast' + (t.leaving ? ' leaving' : '')} style={{ ['--tt-color' as any]: k.color }} role="status">
              <i className={`bi ${k.icon} tt-icon`}></i>
              <div className="tt-body">
                <div className="tt-title">{t.title || k.title}</div>
                <div className="tt-msg">{t.message}</div>
              </div>
              <button className="tt-close" aria-label="Close" onClick={() => remove(t.id)}>
                <i className="bi bi-x-lg"></i>
              </button>
              <div className="tt-bar" style={{ animationDuration: `${t.duration}ms` }}></div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToastApi = () => useContext(ToastContext);
