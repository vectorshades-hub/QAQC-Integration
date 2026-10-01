/**
 * /api/actions/* - the former non-/api Flask routes (form posts that flash+redirect, file downloads, JSON helpers).
 * The path after /api/actions is the ORIGINAL Flask path.
 */
import { Router } from 'express';
import { adminRequired } from '../middleware/auth';
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
const admin = adminRequired('page');

// Daily work plan
r.post('/daily-work-plan/add-entry', wrap(daily.addEntryAction));
r.post('/daily-work-plan/add-project/:plan_date/:user_id', wrap(daily.addProjectAction));
r.post('/daily-work-plan/edit/:plan_date/:user_id/:entry_id', wrap(daily.editEntryAction));
r.post('/daily-work-plan/delete/:plan_date/:user_id/:entry_id', wrap(daily.deleteEntryAction));
r.get('/daily-work-plan/export/:plan_date', wrap(daily.exportDailyPlan));

// Work plan
r.post('/work-plan/add', wrap(wp.addWorkPlanAction));
r.post('/work-plan/edit/:wp_id', wrap(wp.editWorkPlanAction));
r.post('/work-plan/delete/:wp_id', wrap(wp.deleteWorkPlanAction));
r.post('/work-plan/refresh-excel', wrap(wp.refreshWorkPlanExcel));

// Leave calendar
r.post('/leave-calendar/set', wrap(leave.leaveSetAction));
r.post('/leave-calendar/clear', wrap(leave.leaveClearAction));

// Master submission / submission log
r.post('/master-submission/add', wrap(sub.addSubmission));
r.get('/master-submission/file/:sub_id/*stored_name', wrap(sub.viewSubmissionFile));
r.post('/master-submission/update/:sid', wrap(sub.updateSubmission));
r.post('/master-submission/delete/:sid', wrap(sub.apiDeleteSubmission));
r.get('/master-submission/export', wrap(sub.exportSubmissions));
r.post('/master-submission/bulk-upload', wrap(sub.bulkUploadSubmissions));
r.post('/master-submission/preview-excel', wrap(sub.previewExcelSubmissions));
r.post('/master-submission/import-excel', wrap(sub.importExcelSubmissions));
r.get('/browse-folder', sub.browseFolder);
r.post('/open-folder', wrap(sub.openFolder));

// Master set
r.post('/master-set/add', wrap(ms.addMasterSet));
r.post('/master-set/:ms_id/edit', wrap(ms.editMasterSet));
r.post('/master-set/:ms_id/add-update', wrap(ms.addMsUpdate));
r.post('/master-set/:ms_id/delete-update/:upd_id', wrap(ms.delMsUpdate));
r.post('/master-set/:ms_id/delete', wrap(ms.deleteMasterSet));
r.post('/master-set/:ms_id/upload-iso', wrap(ms.uploadIso));
r.post('/master-set/:ms_id/upload-left', wrap(ms.uploadLeft));
r.post('/master-set/:ms_id/delete-image/:img_id', wrap(ms.delMsImage));
r.get('/master-set/:ms_id/image/:img_id', wrap(ms.serveMsImage));
r.get('/master-set/:ms_id/export', wrap(ms.exportMsExcel));

// Ownership log
r.get('/ownership-log/template', wrap(ol.downloadOlTemplate));
r.post('/ownership-log/add', wrap(ol.addOwnershipRecord));
r.post('/ownership-log/import-excel', wrap(ol.importOlExcel));
r.post('/ownership-log/preview-new-records', wrap(ol.previewNewOlRecords));
r.post('/ownership-log/delete-multiple', adminRequired('api'), wrap(ol.deleteOlMultiple));
r.post('/ownership-log/add-records-json', wrap(ol.addOlRecordsJson));
r.post('/ownership-log/:ms_id/edit', wrap(ol.editOwnershipLog));

// Users (admin)
r.post('/users/add', admin, wrap(users.addUserAction));
r.post('/users/edit/:uid', admin, wrap(users.editUserAction));
r.post('/users/delete/:uid', admin, wrap(users.deleteUserAction));
r.post('/users/hard-delete/:uid', admin, wrap(users.hardDeleteUserAction));
r.post('/users/restore/:uid', admin, wrap(users.restoreUserAction));
r.get('/users/export-excel', admin, wrap(users.exportUsersExcel));
r.post('/users/bulk-import', admin, wrap(users.bulkImportUsers));

// Teams (admin)
r.post('/teams/add', admin, wrap(tp.addTeam));
r.post('/teams/edit/:team_id', admin, wrap(tp.editTeam));
r.post('/teams/delete/:team_id', admin, wrap(tp.deleteTeam));

// Projects & clients
r.post('/projects/client/add', wrap(tp.addClient));
r.post('/projects/client/edit/:cid', wrap(tp.editClient));
r.post('/projects/client/delete/:cid', wrap(tp.deleteClient));
r.post('/projects/client/hard-delete/:cid', admin, wrap(tp.hardDeleteClient));
r.post('/projects/project/add', wrap(tp.addProjectEntry));
r.post('/projects/project/edit/:pid', wrap(tp.editProjectEntry));
r.post('/projects/project/delete/:pid', wrap(tp.deleteProjectEntry));
r.post('/projects/project/hard-delete/:pid', admin, wrap(tp.hardDeleteProjectEntry));

// Events (admin)
r.post('/events/add', admin, wrap(events.eventsAdd));
r.post('/events/edit/:eid', admin, wrap(events.eventsEdit));
r.post('/events/delete/:eid', admin, wrap(events.eventsDelete));

// Backup
r.post('/backup-excel', sys.backupExcel);

export default r;
