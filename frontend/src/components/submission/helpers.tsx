'use client';
import { useCallback } from 'react';
import { kindFromBg, useToastApi } from '@/context/Toast';

/** Text of the "Compose Email" / "copy email template" clipboard content (identical in both templates). */
export function buildEmailText(project: string, pkg: string, rating: string, checkPrintYes: boolean): string {
  const checkPrint = checkPrintYes ? 'Yes' : 'No';
  return (
    'Hi ,\nPlease find the attached QAQC reviewed drawings as per below mail and proceed with comments. Also see the below QAQC review rating information for the package.\n \nQUALITY RATING\n+-----------------------+\nProject Name: ' +
    project +
    '\nQc Package: ' +
    pkg +
    '\nOFA/FAB: OFA\nCheck Print: ' +
    checkPrint +
    '\nRating: ' +
    rating +
    '\nRemarks: Comments as noted\nProject Complexity: MEDIUM\n+-----------------------+'
  );
}

function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    document.execCommand('copy');
    ok = true;
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/** navigator.clipboard when available (secure context), otherwise textarea + execCommand. Resolves true on success. */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopy(text);
    }
  }
  return fallbackCopy(text);
}

/** Copy/feedback toast shared by the submission pages (delegates to the global toast layer). */
export function useToast(_id?: string, _variant?: 'ms' | 'log') {
  const api = useToastApi();
  const show = useCallback((msg: string, bg?: string) => api.show(kindFromBg(bg), msg), [api]);
  return { show, node: null };
}
