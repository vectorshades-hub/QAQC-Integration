'use client';
/**
 * React port of templates/base.html: top bar, offcanvas navigation, flash alerts,
 * main content wrapper, Schedule-Track import toast and the events/birthday popup.
 */
import { ReactNode, Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { useState } from 'react';
import { SessionProvider, useSession } from '@/context/Session';
import { FlashProvider, useFlash } from '@/context/Flash';
import { apiHandlers, apiPost } from '@/lib/api';
import StToast from './StToast';
import { ToastProvider, kindFromCategory, useToastApi } from '@/context/Toast';
import EventsPopup from './EventsPopup';

const PUBLIC_PATHS = ['/', '/login'];

// <title> of each page = `{% block title %}` of the original Jinja template (dynamic detail pages set their own)
const PAGE_TITLES: Record<string, string> = {
  '/login': 'Login – QAQC Integration',
  '/dashboard': 'Dashboard – QAQC',
  '/daily-work-plan': 'Daily Work Plan – QAQC',
  '/daily-work-plan/add-entry': 'Add Entry – QAQC',
  '/work-plan': 'Work Plan – QAQC',
  '/work-plan-assignment': 'Work Plan Assignment – QAQC',
  '/leave-calendar': 'Leave Calendar – QAQC',
  '/events': 'Events & Activities – QAQC',
  '/master-submission': 'Package Submission – QAQC',
  '/master-submission/log': 'Submission Log – QAQC',
  '/master-set': 'Project Master Set – QAQC',
  '/ownership-log': 'Ownership Log – QAQC',
  '/users': 'Users – QAQC Admin',
  '/teams': 'Teams – QAQC',
  '/settings': 'Settings – QAQC Integration',
  '/admin/daily-plan-log': 'Daily Plan Audit Log – QAQC',
  '/projects': 'Projects & Clients – QAQC',
};

function LocationWatcher() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { onLocationChange } = useFlash();
  const key = pathname + '?' + search.toString();
  useEffect(() => {
    onLocationChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, refresh } = useSession();
  const { messages, clear, applyResult } = useFlash();
  const toast = useToastApi();
  const [navOpen, setNavOpen] = useState(false);
  const redirecting = useRef(false);
  const loggingOut = useRef(false);

  useEffect(() => {
    const t = PAGE_TITLES[pathname];
    if (!t) return;
    const apply = () => {
      if (document.title !== t) document.title = t;
    };
    apply();
    // Next re-renders its static metadata <title> after client navigations; keep ours on top
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [pathname]);

  // Flash messages (Flask flash()) are shown as toasts, which survive navigation
  useEffect(() => {
    if (!messages.length) return;
    messages.forEach((m) => toast.show(kindFromCategory(m.category), m.message));
    clear();
  }, [messages, clear, toast]);

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const role = user?.role || 'user';
  const isAdmin = user?.role === 'admin';

  // 401 anywhere -> same as Flask login_required
  useEffect(() => {
    apiHandlers.onUnauthorized = () => {
      refresh();
    };
    apiHandlers.onResult = (r) => applyResult(r);
    return () => {
      apiHandlers.onUnauthorized = undefined;
      apiHandlers.onResult = undefined;
    };
  }, [refresh, applyResult]);

  // Auth gate (login_required for page routes)
  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      if (!redirecting.current && !loggingOut.current) {
        redirecting.current = true;
        applyResult({ flash: [{ category: 'warning', message: 'Please log in.' }], redirect: '/login' });
      }
    } else {
      redirecting.current = false;
    }
  }, [loading, user, isPublic, applyResult]);

  const is = (fn: (p: string) => boolean) => fn(pathname);
  const active = {
    dashboard: is((p) => p === '/dashboard'),
    daily: is((p) => p === '/daily-work-plan'),
    workPlan: is((p) => p === '/work-plan'),
    assignment: is((p) => p === '/work-plan-assignment'),
    leave: is((p) => p === '/leave-calendar'),
    events: is((p) => p === '/events'),
    masterSubmission: is((p) => p === '/master-submission'),
    submissionLog: is((p) => p === '/master-submission/log'),
    ownership: is((p) => p.startsWith('/ownership-log')),
    users: is((p) => p === '/users'),
    teams: is((p) => p === '/teams'),
    settings: is((p) => p === '/settings'),
    dailyLog: is((p) => p === '/admin/daily-plan-log'),
    projects: is((p) => p === '/projects'),
  };

  const closeNav = () => setNavOpen(false);
  const cls = (a: boolean) => `nav-link-custom${a ? ' active' : ''}`;

  const doLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    closeNav();
    loggingOut.current = true; // Flask logout redirects to /login without the "Please log in." flash
    await apiPost('/api/auth/logout');
    router.push('/login');
    await refresh();
    setTimeout(() => {
      loggingOut.current = false;
    }, 500);
  };

  return (
    <>
      <Suspense fallback={null}>
        <LocationWatcher />
      </Suspense>

      {/* Top Bar */}
      <div className="topbar">
        <div className="d-flex align-items-center gap-3">
          <button className="btn-menu" type="button" onClick={() => setNavOpen(true)}>
            <i className="bi bi-list"></i>
          </button>
          <Link href="/dashboard" prefetch={false} className="topbar-brand">
            <span className="logo-dot"></span> QAQC <span style={{ opacity: 0.5, fontWeight: 400 }}>Integration</span>
          </Link>
        </div>
        {user && (
          <div className="topbar-right">
            <span className={`role-badge role-${role}`}>{role}</span>
            <div className="user-badge d-none d-sm-flex">
              <i className="bi bi-person-circle"></i>
              {user.full_name || 'User'}
            </div>
            <a
              href="/login"
              onClick={doLogout}
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
            >
              <i className="bi bi-box-arrow-right"></i>
            </a>
          </div>
        )}
      </div>

      {/* Offcanvas Navigation */}
      <Offcanvas show={navOpen} onHide={closeNav} placement="start" id="sideNav" tabIndex={-1}>
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title as="h5">
            <i className="bi bi-grid-3x3-gap me-2"></i>Navigation
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {user ? (
            <>
              <div className="nav-section-label">Main</div>
              <Link href="/dashboard" onClick={closeNav} className={cls(active.dashboard)}>
                <i className="bi bi-speedometer2"></i> Dashboard
              </Link>

              <div className="nav-section-label">QAQC</div>
              <Link href="/daily-work-plan" onClick={closeNav} className={cls(active.daily)}>
                <i className="bi bi-calendar-check"></i> Daily Work Plan
              </Link>
              <Link href="/work-plan" onClick={closeNav} className={cls(active.workPlan)}>
                <i className="bi bi-calendar3"></i> Work Plan
              </Link>
              {isAdmin && (
                <Link href="/work-plan-assignment" onClick={closeNav} className={cls(active.assignment)}>
                  <i className="bi bi-people-fill"></i> WP Assignment
                </Link>
              )}
              <Link href="/leave-calendar" onClick={closeNav} className={cls(active.leave)}>
                <i className="bi bi-calendar2-x"></i> Leave Calendar
              </Link>
              <Link href="/events" onClick={closeNav} className={cls(active.events)}>
                <i className="bi bi-calendar-heart"></i> Events &amp; Activities
              </Link>
              <Link href="/master-submission" onClick={closeNav} className={cls(active.masterSubmission)}>
                <i className="bi bi-send-check"></i> Master Submission
              </Link>
              <Link href="/master-submission/log" onClick={closeNav} className={cls(active.submissionLog)}>
                <i className="bi bi-journal-text"></i> Submission Log
              </Link>
              <Link href="/ownership-log" onClick={closeNav} className={cls(active.ownership)}>
                <i className="bi bi-clipboard2-data-fill"></i> Ownership Log
              </Link>

              {isAdmin && (
                <>
                  <hr className="nav-divider" />
                  <div className="nav-section-label">Admin</div>
                  <Link href="/users" onClick={closeNav} className={cls(active.users)}>
                    <i className="bi bi-people"></i> Users
                  </Link>
                  <Link href="/teams" onClick={closeNav} className={cls(active.teams)}>
                    <i className="bi bi-diagram-3-fill"></i> Teams
                  </Link>
                  <Link href="/settings" onClick={closeNav} className={cls(active.settings)}>
                    <i className="bi bi-gear"></i> Settings
                  </Link>
                  <Link href="/admin/daily-plan-log" onClick={closeNav} className={cls(active.dailyLog)}>
                    <i className="bi bi-journal-text"></i> Daily Plan Log
                  </Link>
                </>
              )}

              <Link href="/projects" onClick={closeNav} className={cls(active.projects)}>
                <i className="bi bi-folder2-open"></i> Projects &amp; Clients
              </Link>

              <hr className="nav-divider" />
              <a href="/login" onClick={doLogout} className="nav-link-custom" style={{ color: 'rgba(232,76,76,0.85)' }}>
                <i className="bi bi-box-arrow-right"></i> Logout
              </a>
            </>
          ) : (
            !loading && (
              <Link href="/login" onClick={closeNav} className="nav-link-custom">
                <i className="bi bi-box-arrow-in-right"></i> Login
              </Link>
            )
          )}
        </Offcanvas.Body>
      </Offcanvas>

      {/* Page Content */}
      <div className="main-content">{loading && !isPublic ? null : user || isPublic ? children : null}</div>

      {user && (
        <>
          <StToast />
          <EventsPopup userId={user.user_id} />
        </>
      )}
    </>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <FlashProvider>
        <ToastProvider>
          <Suspense fallback={null}>
            <Shell>{children}</Shell>
          </Suspense>
        </ToastProvider>
      </FlashProvider>
    </SessionProvider>
  );
}
