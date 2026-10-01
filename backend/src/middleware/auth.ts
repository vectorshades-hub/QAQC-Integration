import { NextFunction, Request, RequestHandler, Response } from 'express';

/** login_required: 401 JSON when there is no session (the frontend redirects to /login with a flash). */
export const loginRequired: RequestHandler = (req, res, next) => {
  if (!req.session || !req.session.user_id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

/**
 * admin_required.
 *  - kind 'page': the original was a page/form route -> flash "Admin only." and redirect to the dashboard
 *  - kind 'api' : the original was a /api route -> plain JSON 403
 */
export const adminRequired =
  (kind: 'page' | 'api' = 'api'): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.session.user_id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.session.role !== 'admin') {
      if (kind === 'page') {
        res.status(403).json({ error: 'Forbidden', flash: [{ category: 'danger', message: 'Admin only.' }], redirect: '/dashboard' });
      } else {
        res.status(403).json({ error: 'Forbidden' });
      }
      return;
    }
    next();
  };

export const isAdmin = (req: Request): boolean => req.session?.role === 'admin';
export const sessionUserId = (req: Request): string => String(req.session?.user_id ?? '');
export const sessionFullName = (req: Request): string => String(req.session?.full_name ?? '');
