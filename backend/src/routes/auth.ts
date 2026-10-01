import { Router } from 'express';
import { getSession, login, loginPage, logout } from '../controllers/authController';
import { wrap } from '../utils/http';

/** Public routes (no login required) */
const r = Router();
r.get('/auth/session', getSession);
r.get('/pages/login', wrap(loginPage));
r.post('/auth/login', wrap(login));
r.post('/auth/logout', logout);
r.get('/auth/logout', logout);

export default r;
