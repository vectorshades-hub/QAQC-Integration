/**
 * GET /api/pages/* - the data each Flask template used to receive from render_template().
 */
import { Router } from 'express';
import { adminRequired } from '../middleware/auth';
import { dashboardPage } from '../controllers/authController';
import { addEntryPage, dailyWorkPlanPage } from '../controllers/dailyPlanController';
import { eventsPage } from '../controllers/eventsController';
import { leaveCalendarPage } from '../controllers/leaveController';
import { masterSetDetailPage, masterSetPage } from '../controllers/masterSetController';
import { ownershipLogDetailPage, ownershipLogPage } from '../controllers/ownershipController';
import { masterSubmissionPage, submissionLogPage } from '../controllers/submissionController';
import { settingsPage } from '../controllers/systemController';
import { projectsPage, teamsPage } from '../controllers/teamsProjectsController';
import { addUserPage, editUserPage } from '../controllers/usersController';
import { workPlanAssignmentPage, workPlanPage } from '../controllers/workPlanController';
import { wrap } from '../utils/http';

const r = Router();
const admin = adminRequired('page');

r.get('/dashboard', wrap(dashboardPage));
r.get('/daily-work-plan', wrap(dailyWorkPlanPage));
r.get('/add-entry', wrap(addEntryPage));
r.get('/work-plan', wrap(workPlanPage));
r.get('/work-plan-assignment', admin, wrap(workPlanAssignmentPage));
r.get('/leave-calendar', wrap(leaveCalendarPage));
r.get('/master-submission', wrap(masterSubmissionPage));
r.get('/submission-log', wrap(submissionLogPage));
r.get('/master-set', wrap(masterSetPage));
r.get('/master-set/:ms_id', wrap(masterSetDetailPage));
r.get('/ownership-log', wrap(ownershipLogPage));
r.get('/ownership-log/:ms_id', wrap(ownershipLogDetailPage));
// /users and /admin/daily-plan-log were admin-only Flask pages (redirect + "Admin only."); their data comes from /api/*
r.get('/users', admin, (_req, res) => res.json({}));
r.get('/admin/daily-plan-log', admin, (_req, res) => res.json({}));
r.get('/users/add', admin, wrap(addUserPage));
r.get('/users/edit/:uid', admin, wrap(editUserPage));
r.get('/teams', admin, wrap(teamsPage));
r.get('/projects', wrap(projectsPage));
r.get('/events', eventsPage);
r.get('/settings', admin, wrap(settingsPage));

export default r;
