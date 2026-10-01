'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, ApiError } from '@/lib/api';
import { useFlash } from '@/context/Flash';

/**
 * Fetch the data a Flask template used to receive (GET /api/pages/...).
 * Pass `null` to skip. Refetches when `path` changes, when `reload()` is called,
 * or when an action redirects to the page that is already open.
 */
export function usePageData<T = any>(path: string | null) {
  const { tick } = useFlash();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<ApiError | null>(null);
  const [n, setN] = useState(0);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    if (lastPath.current !== path) setData(null); // new page/query: show loading state
    lastPath.current = path;
    setLoading(true);
    apiGet<T>(path)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e : new ApiError(0, { error: String(e) }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick, n]);

  const reload = useCallback(() => setN((x) => x + 1), []);
  return { data, loading, error, reload, setData };
}
