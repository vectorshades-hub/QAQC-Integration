'use client';
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ActionResult, FlashMsg, apiSend, SendBody } from '@/lib/api';

type Ctx = {
  messages: FlashMsg[];
  /** Drop all pending flash messages (the toast layer takes them over). */
  clear: () => void;
  /** Show flash messages (Flask `flash()`), optionally navigating (Flask `redirect()`). */
  applyResult: (r: ActionResult) => void;
  /** Increments to make every usePageData() refetch (used when a redirect targets the page already open). */
  tick: number;
  reload: () => void;
  /** internal: AppShell calls this on every location change */
  onLocationChange: () => void;
};

const FlashContext = createContext<Ctx>({
  messages: [],
  clear: () => {},
  applyResult: () => {},
  tick: 0,
  reload: () => {},
  onLocationChange: () => {},
});

export function FlashProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [messages, setMessages] = useState<FlashMsg[]>([]);
  const [tick, setTick] = useState(0);
  const keepRef = useRef(false);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const applyResult = useCallback(
    (r: ActionResult) => {
      if (!r) return;
      if (r.flash && r.flash.length) setMessages(r.flash);
      if (r.redirect) {
        const cur = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
        if (r.redirect === cur) {
          keepRef.current = false;
          setTick((t) => t + 1);
        } else {
          keepRef.current = true; // keep the flash across the next navigation, like Flask
          router.push(r.redirect);
        }
      }
    },
    [router]
  );

  const clear = useCallback(() => setMessages([]), []);

  const onLocationChange = useCallback(() => {
    if (keepRef.current) keepRef.current = false;
    else setMessages([]);
  }, []);

  return (
    <FlashContext.Provider value={{ messages, clear, applyResult, tick, reload, onLocationChange }}>
      {children}
    </FlashContext.Provider>
  );
}

export const useFlash = () => useContext(FlashContext);

/**
 * Convenience for form-style actions:
 *   const run = useAction();
 *   const res = await run('POST', '/api/actions/users/add', formData);
 * Flash messages and `redirect` in the response are applied automatically.
 */
export function useAction() {
  const { applyResult } = useFlash();
  return useCallback(
    async (method: 'POST' | 'PUT' | 'DELETE', path: string, data?: SendBody) => {
      const res = await apiSend(method, path, data);
      applyResult(res);
      return res;
    },
    [applyResult]
  );
}
