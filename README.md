# QAQC Integration Platform (Next.js + Express + MongoDB)

Full-stack migration of the original Flask + Jinja + PostgreSQL app (`../web_v1.1`) to:

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript, Bootstrap 5 / Bootstrap Icons |
| Backend | Node.js + Express 5 + TypeScript, Mongoose |
| Database | MongoDB Community Edition (local, `mongodb://localhost:27017/qaqc`) |

The migration is **behaviour-preserving**: every page, workflow, validation, Excel import/export, file upload,
scheduled job and permission rule of the original is reproduced. See [MIGRATION_ANALYSIS.md](MIGRATION_ANALYSIS.md).

```
web_v2/
├── frontend/      Next.js app (pages = ports of the Jinja templates)
├── backend/       Express API (routes → controllers → services → Mongoose models)
├── database/      MongoDB scripts: indexes, seed, master-list import, PostgreSQL → MongoDB migration
├── docs/          API_CONTRACT.md (route/template ↔ endpoint mapping)
├── tests/         API end-to-end test + browser smoke test
├── .env.example   every setting, documented
└── README.md
```

## Prerequisites

* Node.js 20+ (developed on Node 24) and npm
* MongoDB Community Edition running locally (default `localhost:27017`; on Windows it runs as the *MongoDB* service)

## First-time setup

```powershell
cd web_v2
npm run install:all                 # installs backend, frontend and database script dependencies
npm i                               # root: only 'concurrently' for `npm run dev`

copy .env.example backend\.env      # then edit backend\.env (see "Configuration")
copy .env.example frontend\.env.local   # frontend only needs BACKEND_URL
```

The backend creates its indexes and seeds the initial admin on first start (users collection empty):

| Full name | Password | Role |
|---|---|---|
| `Administrator` | `admin123` | admin |

No default teams are created — add them manually via **Manage Teams**.
Create the remaining users from **Users → Add**, or import them from Excel there.

## Run (development)

```powershell
npm run dev            # API on http://localhost:8001  +  web UI on http://localhost:5001
# or separately:
npm run dev:backend
npm run dev:frontend
```

Open **http://localhost:5001**. The browser only talks to Next.js; Next proxies every `/api/*` request to the Express
API (`BACKEND_URL`), so the session cookie is same-origin and no CORS setup is needed. Both servers listen on all
interfaces, so colleagues on the LAN use `http://<server-ip>:5001`.

## Run (production)

```powershell
# BACKEND_URL is baked into the Next.js build (rewrite rule) - set it before building
$env:BACKEND_URL = "http://localhost:8001"
npm run build                        # compiles backend (dist/) and builds the frontend
npm run start:backend                # API
npm run start:frontend               # web UI on :5001
```

Use a process manager (pm2, NSSM, Windows Task Scheduler…) to keep both processes running.

## Configuration (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8001` | Express API port |
| `MONGODB_URI` | `mongodb://localhost:27017/qaqc` | MongoDB connection |
| `SESSION_SECRET` | *(dev default + warning)* | Signs the session cookie — set a long random value |
| `SESSION_MAX_AGE_DAYS` | `365` | Login lifetime (the original used a 365-day permanent session) |
| `DATA_DIR` | `./data` | Backups (`backup/`), fallback uploads (`submissions_files/`), master-set images, generated `.xlsx` |
| `SCHEDULE_TRACK_MONGODB_URI` | `mongodb://localhost:27017/schedule_tracker` | MongoDB database of the external **Schedule Track** app (same local server). Its `records` collection is read for the Work Plan import and `records.qaqc` is written back when a daily-plan entry is completed. Blank = integration off |
| `SCHEDULE_TRACK_RECORDS_COLLECTION` | `records` | collection name inside that database |
| `ST_AUTO_IMPORT_TIME` | `08:00` | Daily Schedule Track import time (IST) |
| `CORS_ORIGIN` | *(blank)* | Only if a browser must call the API directly instead of through Next.js |

`frontend/.env.local`: `BACKEND_URL` (default `http://localhost:8001`) — where Next proxies `/api/*`.

## Scheduled jobs (in the API process)

* **Daily backup at 00:00 IST** → `DATA_DIR/backup/YYYY-MM-DD/` (daily work plan, work plan, submission log, leave calendar; last 60 days; folders older than 60 days are pruned). Also available on demand (Dashboard / Settings).
* **Schedule Track import at `ST_AUTO_IMPORT_TIME` IST** → imports the next 30 days of records into Work Plan; the UI shows a toast when a new import result appears.

## Passwords

Passwords are stored and compared as **plain text**, as requested. All password handling is isolated in
[`backend/src/services/passwords.ts`](backend/src/services/passwords.ts) (two functions), so adding hashing later means
changing that one file plus a one-off conversion of existing rows. The password field is `select:false` on the model and
the JSON serializer drops any `password` key, so it is never returned by an API or logged.

## Migrating existing data from the old PostgreSQL database

```powershell
cd database
node migrate-from-postgres.mjs --pg "postgresql://postgres:PASSWORD@localhost:5432/qaqc" `
     --files-from "..\..\web_v1.1\data" --files-to "..\backend\data" --drop
```

Copies every table with its original ids (so links, ordering and audit history are unchanged), converts DATE/TIMESTAMP/JSONB
columns, copies master-set images into the new data folder and rewrites their paths, then sets the id counters.
`--dry-run` shows counts only; `--json dump.json` migrates from a JSON export instead (format: `database/sample/pg-dump.example.json`).
Other scripts: `npm run db:init` (indexes), `npm run db:seed`, `node import-master-lists.mjs` (port of `import_master_lists.py`).
The original project folder is never modified.

## Tests

```powershell
node tests/reset-test-db.mjs                     # drop the throw-away qaqc_test database
# start a backend on the test DB, e.g. (PowerShell):
#   $env:MONGODB_URI="mongodb://localhost:27017/qaqc_test"; $env:PORT="5002"; $env:DATA_DIR="./data_test"; npm --prefix backend run start
node tests/api-e2e.mjs http://localhost:5002     # ~165 checks over every API workflow (or via the Next proxy on :5001)
node tests/ui-smoke.mjs http://localhost:5001    # real-browser login + opens every page (needs Microsoft Edge)
```

## Notes

* **Open Folder** buttons (`/api/actions/open-folder`) launch Windows Explorer **on the machine running the API**, like the original.
* Submission files are saved into `<Reference Path>\<Submission Name>` on the server (or `DATA_DIR/submissions_files/…` when no reference path is given) and served from there.
* Legacy templates that no route ever rendered (`add_daily_plan`, `edit_daily_plan`, `add_work_plan`, `edit_entry`, `_record_rows`) were intentionally not ported — they were unreachable in the original app.
