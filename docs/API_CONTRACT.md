# API Contract (Express backend <-> Next.js frontend)

The original app is a Flask app (`web_v1.1/app.py`) with Jinja templates. In the migration the
Flask *routes* became Express *routes* and the Jinja *templates* became React pages.
To keep behaviour identical, the mapping between the two is mechanical:

| Old Flask thing | New thing |
|---|---|
| A route that called `render_template(x, **ctx)` | `GET /api/pages/<page>` returning `ctx` as JSON (same variable names) |
| A form-POST route that flashed + redirected | `POST /api/actions/<old path>` returning `{ok, flash, redirect}` |
| A route that already returned JSON / a file | `/api/actions/<old path>` (if it was NOT under /api) with the **same** response; routes already under `/api/...` keep the **same path and shape** |
| `session.get('user_id'/'role'/'full_name')` | `useSession().user` (`user_id` is a string, `role`, `full_name`, `username`) |
| `url_for('x', ...)` / `<a href>` between pages | Next.js route with the **same URL path as the Flask page** (see route table) |
| `flash(msg, category)` + `redirect()` | action response `flash:[{category,message}]`, `redirect:'/path?query'` (client helper applies both) |

Browser only calls same-origin `/api/...`; Next.js rewrites `/api/*` to the backend (`http://localhost:5001`).

## Conventions

* **Request bodies.** Form-style actions accept `multipart/form-data` (`FormData`), `application/x-www-form-urlencoded`
  (`URLSearchParams`) or JSON. Field names are **exactly the Flask `request.form` field names** (e.g. `user_id` repeated for
  multi-select, `plan_date_from`, `file_d`, `left_images`, `excel_file`). JSON-API routes take the same JSON as before.
* **Dates.** Python `date` -> `"YYYY-MM-DD"`. `datetime`/timestamp -> `"YYYY-MM-DD HH:MM:SS.ffffff"` (like `str(datetime)`).
  Many "date" columns are free TEXT (`submission_date`, `received_date`, ...) and may be `""`.
* **IDs.** `users.id`, `teams.id`, `clients.id`, `projects.id`, `work_plans.id`, `submissions.id`, `master_sets.id`,
  `master_set_updates.id`, `master_set_images.id`, `events.id`, `work_plan_user_assignments.id` are **integers**
  (auto-increment, like Postgres SERIAL). `daily_plan_entries.id` is an 8-char string.
  Rows never contain Mongo's `_id`/`__v`. **Passwords are never returned by any endpoint.**
* **Auth errors.** No session -> HTTP 401 `{error:'Unauthorized'}` (the api helper redirects to `/login` with flash
  "Please log in."). Non-admin on an admin route -> HTTP 403 `{error:'Forbidden'}`; for routes that were *pages/forms*
  the body also has `flash:[{category:'danger',message:'Admin only.'}]` and `redirect:'/dashboard'` (helper applies it).
* **Form action result.** `POST /api/actions/...` (form-style) always returns HTTP 200
  `{ok:true|false, flash:[{category,message}...], redirect?:'/frontend/path?query'}`. Use `useAction()` from
  `@/context/Flash` which sends the request and applies `flash` + `redirect` (a redirect to the URL already open triggers
  a data reload, exactly like Flask re-rendering the page).
* **Files/downloads** are plain `GET` links, e.g. `<a href="/api/actions/master-submission/export">`.
* Category values are Bootstrap alert types: `success | danger | warning | info`.

## Frontend routes (same paths as the Flask pages)

`/` (redirect), `/login`, `/dashboard`, `/daily-work-plan` (`?date=`), `/daily-work-plan/add-entry` (`?date=&user_id=`),
`/work-plan` (`?view=week|month&wy=&ww=&year=&month=`), `/work-plan-assignment`, `/leave-calendar` (`?year=&month=`),
`/events`, `/master-submission`, `/master-submission/log` (`?page=&q=&team=&checker=&rating=&sort=&order=`),
`/ownership-log` (`?q=&domain=&client=&status=&qc_done=&team=&sort_col=&sort_dir=&page=`), `/ownership-log/[id]`,
`/master-set`, `/master-set/[id]`, `/users`, `/users/add`, `/users/edit/[id]`, `/teams`, `/settings`,
`/admin/daily-plan-log`, `/projects`.

---

## Auth / shell

| Method & path | Notes |
|---|---|
| `GET /api/auth/session` | `{authenticated:bool, user?:{user_id, username, full_name, role}}` (never 401) |
| `GET /api/pages/login` (public) | `{all_users:[{id,username,full_name}]}` (active users, by full_name) |
| `POST /api/auth/login` (public) | form `username`,`password`. OK -> `{ok:true, flash:[success "Welcome back, <full_name>!"], redirect:'/dashboard'}`; bad -> `{ok:false, flash:[danger "Invalid credentials or account inactive."]}` (HTTP 200) |
| `POST /api/auth/logout` | `{ok:true, redirect:'/login'}` |
| `GET /api/st-import/status` | `{}` or `{time_iso, inserted, skipped}` (used by toast in shell) |
| `GET /api/events/today` | `{birthdays:[{id,full_name,birthday}], announcements:[{id,title,description}], current_user_id:int, today}` (shell popup) |

## Dashboard
* `GET /api/pages/dashboard` -> `{today:'YYYY-MM-DD', on_leave:int, leave_today:[{name,status}]}`
* `GET /api/dashboard` -> `{stats:{total,completed,in_progress,on_leave}, leave:[{user_name,status}], recent_subs:[{id,submission_name,client,team,rating,submission_date}], ms_recent:[{id,job_name,client,team,received_date}]}`

## Daily work plan
* `GET /api/pages/daily-work-plan?date=YYYY-MM-DD` -> `{selected_date, today_iso, users:[{id,full_name,team}], day_data:{ "<user_id>": {user_name, entries:[Entry]} }, clients:[str], projects:[str]}`
  (`selected_date` is `YYYY-MM-DD`; invalid/missing date -> today).
* `GET /api/pages/add-entry?date=&user_id=` -> `{pre_date, pre_user, users}`
* `POST /api/actions/daily-work-plan/add-entry` form: `_orig_entry_id`, `user_id` (repeatable), `plan_date_from`/`plan_date`, `plan_date_to`, `status`, `project_name`, `client_name`, `submission_date`, `received_date`, `submitted_date`, `notes`, `expected_completion` -> flash + redirect `/daily-work-plan?date=<from>`
* `POST /api/actions/daily-work-plan/add-project/:plan_date/:user_id` form (`status, submitted_date, project_name, client_name, submission_date, received_date, notes, expected_completion`) -> redirect `/daily-work-plan?date=<plan_date>`
* `POST /api/actions/daily-work-plan/edit/:plan_date/:user_id/:entry_id` form (same fields + optional `user_id` to reassign) -> same redirect
* `POST /api/actions/daily-work-plan/delete/:plan_date/:user_id/:entry_id` -> same redirect
* `GET /api/actions/daily-work-plan/export/:plan_date` -> `Daily_<date>.xlsx`
* `GET /api/daily-plan?date=` -> `{users, entry_map:{uid:[Entry]}, clients, projects}`
* `POST /api/daily-plan/add` JSON `{user_id, plan_date, status, project_name, client_name, submission_date, received_date, submitted_date, notes, expected_completion}` -> Entry
* `POST /api/daily-plan/edit/:eid` JSON (same, optional `user_id`) -> Entry
* `DELETE /api/daily-plan/delete/:eid` -> `{ok:true}`
* `POST /api/daily-plan/transfer` JSON `{from_user_id,to_user_id,date_from,date_to}` -> `{ok, transferred, message}` / `{ok:false,error}` (400/404)

`Entry` = `{id, plan_date, user_id, user_name, project_name, client_name, submission_date, received_date, submitted_date, status, notes, schedule_track_id, expected_completion, created_at}`
(`status` in `PENDING | IN PROGRESS | COMPLETED | LEAVE | TRAINING | HALF_DAY_AM | HALF_DAY_PM`).

## Work plan
* `GET /api/pages/work-plan?view=week|month&wy=&ww=&year=&month=` -> exactly the Jinja context:
  `{view, all_dates:[iso], team_names:[str], all_teams_data:[{id,name,is_active}], plans_dict:{ "<team>": { "<iso date>": [WorkPlan] } }, year, month, projects:[str], today_iso, today_year, today_month, today_wy, today_ww, prev_year, prev_month, next_year, next_month, iso_year, iso_week, prev_wy, prev_ww, next_wy, next_ww, wp_color_even, wp_color_odd}`
  (`plans_dict` replaces the Python tuple-keyed dict `(team, date)`; keys absent when there are no plans. Fields not applicable to the view are `null`.)
* `POST /api/actions/work-plan/add` form `team_name, plan_date, project_name, date_confirmed, notes` -> flash "Added." redirect `/work-plan?year=Y&month=M`
* `POST /api/actions/work-plan/edit/:id` (same fields) -> flash "Updated." redirect `/work-plan?year=&month=`
* `POST /api/actions/work-plan/delete/:id` -> flash "Deleted." redirect
* `POST /api/actions/work-plan/refresh-excel` -> flash "work_plans.xlsx refreshed."; **no redirect** (stay on page)
* `GET /api/work-plan?view=&wy=&ww=&year=&month=` -> `{dates, entries, teams, nav, view, today_wy, today_ww, today_year, today_month}`
* `POST /api/work-plan/add`, `POST /api/work-plan/edit/:wid` (JSON `team_name, plan_date, project_name, date_confirmed, notes`) -> WorkPlan; `DELETE /api/work-plan/delete/:wid` -> `{ok:true}`
* `POST /api/work-plan/load-from-schedule-track` -> `{ok, inserted, skipped, message, date_range}` or `{ok:false,error}` (503 if the Schedule Track MongoDB is unreachable / 500)

`WorkPlan` = `{id, team_name, plan_date, project_name, date_confirmed ('confirmed'|'unconfirmed'|'post_ofa'|'schedule_imported'|'qc_not_required'), notes, schedule_track_id, created_at}`

## Work plan assignment (admin)
* `GET /api/pages/work-plan-assignment` -> `{teams:[{id,name}], users:[{id,full_name,team}], assign_map:{ "<team>": [{id,team_name,user_id,is_default,user_name}] }}`
* `GET /api/work-plan-assignment` -> `{assignments:[...]}`; `POST /api/work-plan-assignment/save` JSON `{team_name,user_ids,default_user_id}` -> `{ok, copied}`; `DELETE /api/work-plan-assignment/delete/:aid` -> `{ok}`

## Leave calendar
* `GET /api/pages/leave-calendar?year=&month=` -> `{today, year, month, month_name, weeks:[[iso x7]], leave_data:{ "<iso>": {"<uid>":{name,status}} }, all_users:[{id,full_name}], leave_counts:{uid:{name,leave,training,half_day,total}}, leave_counts_list:[{uid,name,leave,training,half_day,total}], prev_year, prev_month, next_year, next_month, lock_before, is_admin, viewing_locked_month}`
* `POST /api/actions/leave-calendar/set` form `plan_date,user_id,status` and `POST /api/actions/leave-calendar/clear` form `plan_date,user_id` -> flash + redirect `/leave-calendar?year=&month=`
* `GET /api/leave-calendar`, `POST /api/leave-calendar/set`, `POST /api/leave-calendar/clear` (JSON, unchanged; 403 `{error:'Period locked. Contact administrator.'}`)

## Master submission / submission log
* `GET /api/pages/master-submission` -> `{today, teams:[str], checkers:[str], clients:[str], projects:[str]}`; `GET /api/master-submission/meta` -> `{teams,checkers,clients,projects}`
* `POST /api/actions/master-submission/add` multipart: fields `received_date, submission_date, qc_checker, team, client, rating, num_e_sheets, num_d_sheets, check_print, job_name, submission_name, remarks, main_folder` + files `file_d`, `file_e`, `file_cp` (multiple each) -> flash(es) + redirect `/master-submission`
* `GET /api/actions/master-submission/file/:sub_id/:stored_name` -> streams file (inline for pdf/images, attachment otherwise)
* `GET /api/actions/browse-folder` -> `{path:'', note}`; `POST /api/actions/open-folder` JSON `{path}` -> `{ok, error?}`
* `GET /api/pages/submission-log?page=&q=&team=&checker=&rating=&sort=&order=` -> `{submissions:[Submission], teams, checkers, clients, page, total_pages, total, per_page, stats:{rating:count}, q, team_filter, checker_filter, rating_filter, sort, order}` (50/page)
* `GET /api/submissions/:sid` -> Submission or 404 `{error:'Not found'}`; `GET /api/submissions?...` -> `{items,total,page,pages,per_page,teams,ratings}`; `DELETE /api/submissions/:sid` -> `{ok:true}`
* `POST /api/actions/master-submission/update/:sid` (form, all editable fields) -> `{ok:true}`; `POST /api/actions/master-submission/delete/:sid` -> `{ok:true}`
* `GET /api/actions/master-submission/export` -> `submissions.xlsx`
* `POST /api/actions/master-submission/bulk-upload | preview-excel | import-excel` multipart `excel_file` -> JSON exactly as before (`{ok, inserted, skipped, errors}` / `{ok,total,existing,new,parse_errors}` / `{ok:false,error}`)

`Submission` = `{id, received_date, submission_date, qc_checker, team, client, rating, num_e_sheets, num_d_sheets, check_print ('True'|'False'), job_name, submission_name, remarks, main_folder, files_copied:[str], uploaded_files:[{type,original,stored,dest_dir}], submitted_by, created_at}`

## Master set
* `GET /api/pages/master-set` -> `{ms_list:[MasterSet & {update_count, updates:[{}...update_count]}], teams, checkers, clients, projects}`
* `GET /api/master-sets`, `/api/master-sets/meta`, `/api/master-sets/:id` (unchanged JSON)
* `POST /api/actions/master-set/add` form `job_name, fabricator, client, received_date, working_days, team, qc_checker, email_body` -> flash "Master Set #N created." redirect `/master-set/N`
* `GET /api/pages/master-set/:id` -> `{ms_id, rec:MasterSet, updates:[{id,upd_date,remark}], left_images:[Image], iso_image:Image|null, teams, checkers, clients, projects, today}`; missing -> 404 with `flash:[danger "Not found."]`, `redirect:'/master-set'`
* `POST /api/actions/master-set/:id/edit` form `job_name,fabricator,client,received_date,working_days,team,qc_checker,email_body,folder_path` -> flash "Updated." redirect `/master-set/:id`
* `POST /api/actions/master-set/:id/add-update` form `update_date, update_remark`; `.../delete-update/:upd_id`; `.../delete` (redirect `/master-set`); `.../upload-iso` (file `iso_image`); `.../upload-left` (files `left_images`); `.../delete-image/:img_id` -> flash + redirect `/master-set/:id`
* `GET /api/actions/master-set/:id/image/:img_id` -> image; `GET /api/actions/master-set/:id/export` -> `MasterSet_<name>.xlsx`

`MasterSet` = `{id, job_name, fabricator, client, received_date, working_days, team, qc_checker, email_body, submitted_by, created_at, domain, ol_status, qc_done, done_by, ol_remarks, folder_path}`; `Image` = `{id, side:'left'|'iso', path, sort_order}`

## Ownership log (same `master_sets` collection)
* `GET /api/pages/ownership-log?q=&domain=&client=&status=&qc_done=&team=&sort_col=&sort_dir=&page=` -> `{rows:[MasterSet], q, flt_domain, flt_client, flt_status, flt_qc_done, flt_team, all_domains, all_clients, all_statuses, all_teams, all_projects, checkers, is_admin, page, total_pages, total, per_page:50, sort_col, sort_dir}`
* `GET /api/pages/ownership-log/:id` -> `{ms_id, rec, updates, teams, checkers, all_domains, all_clients, is_admin}`; missing -> 404 + flash "Record not found." redirect `/ownership-log`
* `POST /api/actions/ownership-log/:id/edit` (form `domain, ol_status, qc_done, done_by, ol_remarks` + admin-only `client, qc_checker`) -> flash "Ownership record updated." redirect `/ownership-log/:id`
* `POST /api/actions/ownership-log/add` form `job_name, domain, client, qc_checker, team, received_date, working_days, ol_status, qc_done` -> flash "Record #N created." redirect `/ownership-log/N`
* `POST /api/actions/ownership-log/import-excel | preview-new-records` (multipart `excel_file`), `POST /api/actions/ownership-log/delete-multiple` (admin, JSON `{ids}`), `POST /api/actions/ownership-log/add-records-json` (JSON `{records}`) -> JSON exactly as before
* `GET /api/actions/ownership-log/template` -> `ownership_log_template.xlsx`
* `POST /api/ownership-log/:id/qc-done` JSON `{qc_done}` (admin) -> `{ok:true}`

## Users (admin)
* `GET /api/users?page=&per_page=&q=&role=&status=active|inactive` -> `{items:[{id,username,full_name,email,role,team,is_active,created_at}],total,page,pages}` (no password)
* `GET /api/pages/users` and `GET /api/pages/admin/daily-plan-log` -> `{}`; admin-only gate for those two pages (403 + flash "Admin only." + redirect `/dashboard` for non-admins); the data itself comes from `/api/users` / `/api/admin/daily-plan-log`.
* `GET /api/pages/users/add` -> `{teams:[str]}`; `POST /api/actions/users/add` form `username, full_name, email, password, role, team, birthday` -> success: flash + redirect `/users`; duplicate: `{ok:false, flash:[danger "Username or email already exists."]}` (no redirect)
* `GET /api/pages/users/edit/:uid` -> `{user:{id,username,full_name,email,role,team,is_active,birthday,created_at}, teams:[str]}` (NO password); missing -> 404 flash "Not found." redirect `/users`
* `POST /api/actions/users/edit/:uid` form `full_name,email,role,team,is_active (present=true),password (blank=keep),birthday` -> flash "Updated." redirect `/users`
* `POST /api/actions/users/delete/:uid` (deactivate), `/hard-delete/:uid`, `/restore/:uid` -> flash + redirect `/users`
* `GET /api/actions/users/export-excel`; `POST /api/actions/users/bulk-import` multipart `file` -> `{ok, added, updated, skipped, errors}`
* `GET|POST /api/users/:uid/wp-theme` (`{row_even,row_odd}`), `GET /api/users/duplicates` -> `{groups}`, `POST /api/users/merge` JSON `{keep_id,merge_id}`, `POST /api/users/:uid/birthday` JSON `{birthday}`

## Teams (admin), Projects & Clients
* `GET /api/pages/teams` -> `{teams:[{id,name,is_active}]}`; `GET /api/teams` -> `{items}`; `POST /api/actions/teams/add` (form `name`), `/teams/edit/:id` (form `name`), `/teams/delete/:id` -> flash + redirect `/teams`; `POST /api/teams/merge` JSON `{keep_id,merge_id}` -> `{ok, message}`
* `GET /api/pages/projects` -> `{clients:[{id,name,is_active,created_at}], projects:[...]}`; actions (form `name`) `POST /api/actions/projects/client/add|edit/:id|delete/:id|hard-delete/:id` and `POST /api/actions/projects/project/add|edit/:id|delete/:id|hard-delete/:id` -> flash + redirect `/projects` (hard-delete is admin only); `GET /api/projects`, `GET /api/master-lists` unchanged.

## Events
* `GET /api/pages/events` -> `{is_admin}`; `GET /api/events` -> `{items}`; `GET /api/events/birthdays` -> `{items}`
* `POST /api/actions/events/add` form `title,description,event_date`; `/events/edit/:id` form `title,description,event_date,is_active`; `/events/delete/:id` -> flash + redirect `/events` (admin)

## Settings / backup / audit (admin unless noted)
* `GET /api/pages/settings` -> `{st_auto_import_time, last_st_import, next_run, last_backup, next_backup, backup_folders:[{date,files:[{name,path,size_kb}]}]}`
* `POST /api/st-import/run-now` -> `{ok:true,message}`
* `POST /api/actions/backup-excel` (any user) -> `{ok:true, flash:[success "Backup started - files will appear in data/backup/YYYY-MM-DD/ shortly."]}` (no redirect)
* `GET /api/backup/status` -> `{last_backup, folders, backup_dir}`; `GET /api/backup/download/*path` -> xlsx
* `GET /api/admin/daily-plan-log?page=&action=&user=&date=` -> `{rows,total,page,pages}`; the `/admin/daily-plan-log` page itself needs no page-data endpoint.
