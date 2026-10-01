import cookieSession from 'cookie-session';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { env } from './config/env';
import { loginRequired } from './middleware/auth';
import actionRoutes from './routes/actions';
import apiRoutes from './routes/api';
import authRoutes from './routes/auth';
import pageRoutes from './routes/pages';
import { cleanupTempFiles, upload } from './utils/files';
import { jsonSerializer } from './utils/http';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  if (env.CORS_ORIGIN) app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Signed-cookie session (same model as Flask's client-side session). Permanent = 365 days by default.
  app.use(
    cookieSession({
      name: 'qaqc_session',
      keys: [env.SESSION_SECRET],
      maxAge: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    })
  );
  // Flask refreshes a permanent session's expiry on every request; touching the session does the same here.
  app.use((req, _res, next) => {
    if (req.session && req.session.user_id) req.session.touched = Math.floor(Date.now() / 60000);
    next();
  });

  app.use(jsonSerializer);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use(upload.any(), cleanupTempFiles); // multipart bodies (files land in a temp dir)
  api.use(authRoutes); // public routes
  api.use(loginRequired); // everything below needs a session
  api.use('/pages', pageRoutes);
  api.use('/actions', actionRoutes);
  api.use(apiRoutes);
  api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use('/api', api);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err?.stack || err);
    if (res.headersSent) return;
    res.status(500).json({ ok: false, error: env.NODE_ENV === 'production' ? 'Internal Server Error' : String(err?.message || err) });
  });

  return app;
}
