/**
 * Pure JSON API - the original /api/* Flask routes, same paths and response shapes.
 */
import { Router } from 'express';
import { adminRequired } from '../middleware/auth';
import { apiDashboard } from '../controllers/authController';
import * as daily from '../controllers/dailyPlanController';
import * as events from '../controllers/eventsController';
import * as leave from '../controllers/leaveController';
import * as ms from '../controllers/masterSetController';
import * as ol from '../controllers/ownershipController';
import * as sub from '../controllers/submissionController';
import * as sys from '../controllers/systemController';
import * as tp from '../controllers/teamsProjectsController';
import * as users from '../controllers/usersController';
import * as wp from '../controllers/workPlanController';
import { wrap } from '../utils/http';

const r = Router();
const admin = adminRequired('api');

r.get('/dashboard', wrap(apiDashboard));

// Daily plan
r.get('/daily-plan', wrap(daily.apiDailyPlan));
r.post('/daily-plan/add', wrap(daily.apiAddEntry));
r.post('/daily-plan/edit/:eid', wrap(daily.apiEditEntry));
r.delete('/daily-plan/delete/:eid', wrap(daily.apiDeleteEntry));
r.post('/daily-plan/transfer', wrap(daily.apiTransfer));

// Work plan
r.get('/work-plan', wrap(wp.apiWorkPlan));
r.post('/work-plan/add', wrap(wp.apiAddWp));
r.post('/work-plan/edit/:wid', wrap(wp.apiEditWp));
r.delete('/work-plan/delete/:wid', wrap(wp.apiDeleteWp));
r.post('/work-plan/load-from-schedule-track', wrap(wp.loadFromScheduleTrack));

// Work plan assignments (admin)
r.get('/work-plan-assignment', admin, wrap(wp.apiGetWpAssignments));
r.post('/work-plan-assignment/save', admin, wrap(wp.apiSaveWpAssignment));
r.delete('/work-plan-assignment/delete/:aid', admin, wrap(wp.apiDeleteWpAssignment));

// Leave calendar
r.get('/leave-calendar', wrap(leave.apiLeaveCal));
r.post('/leave-calendar/set', wrap(leave.apiSetLeave));
r.post('/leave-calendar/clear', wrap(leave.apiClearLeave));

// Submissions
r.get('/master-submission/meta', wrap(sub.apiSubMeta));
r.get('/submissions', wrap(sub.apiSubmissions));
r.get('/submissions/:sid', wrap(sub.apiGetSubmission));
r.delete('/submissions/:sid', wrap(sub.apiDeleteSubmission));

// Master sets
r.get('/master-sets', wrap(ms.apiMasterSets));
r.get('/master-sets/meta', wrap(ms.apiMsMeta));
r.get('/master-sets/:ms_id', wrap(ms.apiMsDetail));

// Ownership log
r.post('/ownership-log/:ms_id/qc-done', wrap(ol.apiOlQcDone));

// Users (admin)
r.get('/users', admin, wrap(users.apiUsers));
r.get('/users/duplicates', admin, wrap(users.apiUserDuplicates));
r.post('/users/merge', admin, wrap(users.apiMergeUsers));
r.get('/users/:uid/wp-theme', admin, wrap(users.userWpTheme));
r.post('/users/:uid/wp-theme', admin, wrap(users.userWpTheme));
r.post('/users/:uid/birthday', admin, wrap(users.userBirthdayApi));

// Teams (admin)
r.get('/teams', admin, wrap(tp.apiTeams));
r.post('/teams/merge', admin, wrap(tp.apiMergeTeams));

// Projects & clients
r.get('/projects', wrap(tp.apiProjects));
r.get('/master-lists', wrap(tp.apiMasterLists));

// Events
r.get('/events', wrap(events.apiEvents));
r.get('/events/today', wrap(events.apiEventsToday));
r.get('/events/birthdays', wrap(events.apiEventsBirthdays));

// Schedule Track import / backups / audit log
r.get('/st-import/status', sys.apiStImportStatus);
r.post('/st-import/run-now', admin, sys.apiStImportRunNow);
r.get('/backup/status', sys.apiBackupStatus);
r.get('/backup/download/*filename', sys.downloadBackup);
r.get('/admin/daily-plan-log', admin, wrap(sys.apiDailyPlanLog));

export default r;
