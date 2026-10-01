'use client';
/** "Auto Imported from Schedule Tracker" toast (port of the #stToast block in base.html). */
import { useEffect, useRef } from 'react';
import { useToastApi } from '@/context/Toast';

const STORAGE_KEY = 'stLastSeenImport';
const POLL_MS = 30000; // check every 30 s

export default function StToast() {
  const toast = useToastApi();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const showToast = (msg: string) => toastRef.current.info(msg, 'Auto Imported from Schedule Tracker');

    function checkImport() {
      fetch('/api/st-import/status', { credentials: 'same-origin', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !data.time_iso) return;
          let seen: string | null = null;
          try {
            seen = localStorage.getItem(STORAGE_KEY);
          } catch {}
          if (seen === data.time_iso) return; // already shown
          try {
            localStorage.setItem(STORAGE_KEY, data.time_iso);
          } catch {}
          const msg =
            data.inserted > 0
              ? `${data.inserted} record(s) imported, ${data.skipped} skipped`
              : `No new records (${data.skipped} already up to date)`;
          showToast(msg);
        })
        .catch(() => {});
    }

    checkImport();
    const iv = setInterval(checkImport, POLL_MS);
    return () => {
      clearInterval(iv);
    };
  }, []);

  return null;
}
