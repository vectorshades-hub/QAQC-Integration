'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type SessionUser = {
  user_id: string;
  full_name: string;
  role: 'admin' | 'management' | 'user' | string;
};

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<SessionUser | null>;
};

const SessionContext = createContext<Ctx>({ user: null, loading: true, refresh: async () => null });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      const u = data && data.authenticated ? (data.user as SessionUser) : null;
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ user, loading, refresh }}>{children}</SessionContext.Provider>;
}

/** Current logged-in user (Flask `session`): { user_id, full_name, role } or null. */
export const useSession = () => useContext(SessionContext);
