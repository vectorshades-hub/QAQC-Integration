# Migration Analysis: Flask + PostgreSQL → Next.js + Express + MongoDB

## 1. Old architecture (`web_v1.1`)
* **One file, `app.py` (~3,400 lines)**: Flask routes + SQL (psycopg2) + Excel (openpyxl) + schedulers (threads) + Windows-only helpers.
* **27 Jinja templates** (12k lines) with inline CSS and vanilla JS, server-rendered forms (POST → flash → redirect) plus a growing set of `/api/*` JSON endpoints.
* **PostgreSQL** (`qaqc`, 16 tables) and a *second, external* PostgreSQL DB (`new_schedule_track`, another app) that is read and updated (`records.qaqc`) — that app now also runs on MongoDB (`schedule_tracker.records`).
* Signed-cookie session (365 days), roles `admin | management | user`, plain-text passwords, files on the server disk (Reference Path / `data/`).
* Background threads: daily Excel backup (00:00 IST), daily Schedule Track import (08:00 IST).

## 2. New architecture (`web_v2`)
| Concern | Old | New |
|---|---|---|
| UI | Jinja templates + bootstrap JS | Next.js App Router pages (`frontend/src/app/**`), react-bootstrap, same CSS/markup/texts; shell = `AppShell` (port of `base.html`) |
| Routes | Flask decorators | Express routers `backend/src/routes` (`pages`, `actions`, `api`, `auth`) |
| Logic | inline in routes | `controllers/` (handlers) + `services/` (audit, Schedule Track, work-plan copy, Excel import/export, backup, passwords) |
| Data | SQL strings | Mongoose models `backend/src/models` |
| Session | Flask cookie | `cookie-session` signed cookie, same 365-day lifetime |
| Config | hard-coded in `app.py` | `.env` (`backend/.env`, `frontend/.env.local`) |
| Wiring | same process | browser → Next.js → (`/api/*` rewrite) → Express → MongoDB |

Template → API mapping rule (see `docs/API_CONTRACT.md`): a route that rendered a template became `GET /api/pages/<page>` returning the same
variables; a form-POST-and-redirect became `POST /api/actions/<old path>` returning `{ok, flash, redirect}` (the frontend applies both, so
flash messages and redirects behave as before); routes that were already JSON kept their path and response.

## 3. Database mapping (PostgreSQL table → MongoDB collection)
Same names; integer `SERIAL` ids are preserved as an `id` field maintained by a `counters` collection, so URLs, sorting and cross-references are unchanged.

| Table / collection | Notes |
|---|---|
| `users` | `password` plain text, `select:false`, never serialised. `created_at`, `birthday` kept as `YYYY-MM-DD` strings (SQL DATE) |
| `teams`, `clients`, `projects` | unique `name` |
| `daily_plan_entries` | 8-char string `id`; `plan_date` string; `user_id` → null when the user is hard-deleted (was `ON DELETE SET NULL`) |
| `work_plans` | `date_confirmed` ∈ confirmed / unconfirmed / post_ofa / schedule_imported / qc_not_required |
| `submissions` | JSONB `files_copied`, `uploaded_files` → arrays |
| `master_sets`, `master_set_updates`, `master_set_images` | ownership-log fields live on `master_sets`; child rows are cascade-deleted in code (was `ON DELETE CASCADE`) |
| `user_wp_themes`, `work_plan_user_assignments` | cascade with the user; unique (team, user) |
| `daily_plan_audit_log`, `events`, `app_settings` | `details` JSONB → object |
Foreign-key behaviour (`SET NULL` / `CASCADE`) is re-implemented where the rows are deleted. Indexes mirror the originals. `database/migrate-from-postgres.mjs` moves existing data.

## 4. Migrated features (all preserved)
Login (case-insensitive username, active users only) / logout / roles · Dashboard · Daily Work Plan (multi-user, date ranges, LEAVE/TRAINING replacement, status cascade, transfer, Excel export, Schedule Track `qaqc` write-back, audit log) ·
Work Plan (week/month, 5 confirmation states, per-user colours, auto-copy to daily plans with leave fallback, load from Schedule Track, Excel refresh) · WP Assignment (admin) ·
Leave Calendar (leave/training/half-days, monthly lock rule) · Events & birthdays (+ once-a-day popup) · Master Submission (form, file upload/validation/de-duplication, Excel import/preview/bulk upload) ·
Submission Log (filters, sort, paging, edit/delete, file streaming, open folder, export) · Project Master Sets (updates, ISO/left images, Excel export with images) · Ownership Log (filters, QC toggle, import with header auto-detect, JSON bulk add, multi-delete, template) ·
Users (CRUD, restore, hard delete, Excel import/export, work-plan colours, duplicate merge API) · Teams (rename cascade, merge) · Projects & Clients · Settings (backup, Schedule Track) · Daily-plan audit log · daily backup + import schedulers · Schedule Track toast.

Deliberately not ported: `add_daily_plan.html`, `edit_daily_plan.html`, `add_work_plan.html`, `edit_entry.html`, `_record_rows.html` (no route rendered them) and the dead JS in `master_submission.html` (the original page has no file inputs; the upload endpoint still exists).

## 5. Verification performed
* **API end-to-end** (`tests/api-e2e.mjs`): 165 checks over every workflow — auth/roles, users, teams, projects, events, assignments + auto-copy + leave fallback, daily plan (cascade, transfer, audit), leave lock, submissions with real multipart uploads/files, Excel import/preview/export, master sets with images, ownership log, backups, path-traversal guards — pass through the Next.js proxy.
* **Real-browser (Edge/Playwright) verification of every page** against the original templates and `app.py`, in parallel by scope; the resulting fixes are in the code (page titles, logout flash, admin-only redirects, wildcard search, full reloads after imports, form resets…). `tests/ui-smoke.mjs` opens all 18 pages with no console/page/network errors.
* Both TypeScript projects type-check; `next build` and the compiled backend (`dist/`) run.
* `database/` scripts tested on scratch databases (index setup, seed, master-list import from the real `master_lists.xlsx`, PostgreSQL-format migration from a JSON dump incl. counters).

## 6. Known differences / not verifiable here
* **Schedule Track** now runs in MongoDB (`schedule_tracker.records`, mapping: `id→legacyId`, `submission_name→submissionName`, `sub_date→subDate`, `submission_type→submissionType`, `team`, `status`, `qaqc`). Import, idempotent re-import and the `qaqc` write-back were tested against the live collection (write-back restored afterwards). Difference: Schedule Track stores statuses such as `COMPLETED (OVERDUE 3d)`, so the import skips any status *starting with* completed/cancelled (the SQL version matched only the exact words).
* The migration script was verified against a JSON dump in PostgreSQL row format, not a live PostgreSQL.
* Text sorting uses MongoDB's `en` collation (PostgreSQL's depends on its locale); tie order of unusual characters may differ.
* Audit-log detail text is HTML-escaped (the original inserted raw HTML); after a duplicate on *Add User* the form keeps typed values.
* Passwords remain plain text by request; hashing is a one-file change (`backend/src/services/passwords.ts`).
