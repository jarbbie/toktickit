# TokTickIT

TokTickIT is an IT service desk application built incrementally for CPE334.
Labs 1–4 build an authenticated, role-based support workflow with Actions Taken,
Ticket status history, and role-aware dashboards:

- `client/` — React, TypeScript, Vite, Bootstrap, and Playwright
- `server/` — Node.js, Express, TypeScript, Prisma, PostgreSQL, and Vitest/Supertest
- `docs/lab-01/` through `docs/lab-04/` — contracts, test plans, AI-use
  reflections, and peer-review records
- `artifacts/lab-03/screenshots/` and `artifacts/lab-04/screenshots/` — responsive
  browser evidence for authentication, Actions, Ticket workflow, and dashboards

The three supported roles are Requester, IT Staff, and Administrator. Requesters
create and track their own Tickets and see their recent work on the dashboard.
IT Staff use the shared queue, record Actions Taken, and advance Tickets through
the permitted workflow. Administrators manage accounts and initial passwords.
The server enforces ownership, roles, workflow rules, and write concurrency
independently of the UI.

## Prerequisites

- Node.js 22 or later
- npm 10 or later
- PostgreSQL 16 or later, either locally or through Docker

## Initial setup

1. Install dependencies:

   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

2. Create local environment files from the committed templates. Do not commit
   the resulting `.env` files:

   ```bash
   cp client/.env.example client/.env
   cp server/.env.example server/.env
   ```

3. Start one PostgreSQL instance. For a disposable local Docker database:

   ```bash
   docker run --name toktickit-postgres \
     -e POSTGRES_USER=toktickit \
     -e POSTGRES_PASSWORD=toktickit \
     -e POSTGRES_DB=toktickit \
     -p 5432:5432 \
     -v toktickit-postgres-data:/var/lib/postgresql/data \
     -d postgres:16
   ```

   If the container already exists, use `docker start toktickit-postgres`.
   Do not run two PostgreSQL instances on the same host port; update
   `server/.env` if you choose a different port.

4. Generate Prisma, apply migrations, and seed the local fixtures:

   ```bash
   cd server
   npx prisma generate
   npx prisma migrate dev
   npm run prisma:seed
   ```

   The seed is idempotent and creates four active Requesters plus a zero-Ticket
   dashboard account, an inactive Requester, three ticket-owning IT Staff plus
   a zero-ownership dashboard account, an inactive IT Staff account, an active
   Administrator, reference data, realistic Tickets, Actions, workflow events,
   a Public Comment, and an Internal Note. It creates missing fixtures only
   and does not overwrite changed application records. Every seeded account
   starts with the disposable local password `Lab3-Initial-2026!` and must
   change it at first sign-in. Seeded credentials are for local development
   only; they are not production secrets.

## Lab 4 database safety

The migration is additive. It gives existing Tickets `workflowVersion = 1`
without creating Actions or invented status history. Before applying it to a
populated database, stop application writes and make matching database and
attachment-file backups outside the repository. Verify both backups before
running `npx prisma migrate deploy`:

```bash
# Use the same host, port, user, and database as DATABASE_URL; omit Prisma's
# ?schema=... parameter because pg_dump uses libpq connection options.
pg_dump --format=custom --file=/safe/backups/toktickit-before-lab4.dump \
  --host=localhost --port=5432 --username=toktickit toktickit
tar -C server -czf /safe/backups/toktickit-uploads-before-lab4.tar.gz uploads
pg_restore --list /safe/backups/toktickit-before-lab4.dump
tar -tzf /safe/backups/toktickit-uploads-before-lab4.tar.gz
```

The migration runs transactionally on PostgreSQL. If deployment reports a
failed migration, first verify that the DDL transaction rolled back, then mark
that migration rolled back with `prisma migrate resolve --rolled-back` before
retrying the corrected migration. If a completed migration has a data or file
problem, stop writes and restore the database and uploads from the same
verified snapshot, or apply a reviewed forward migration. Do not use
`prisma migrate reset` against a populated database.

Lab 4 migration and seed integration tests require `TEST_DATABASE_URL` to name
a disposable PostgreSQL database ending in `_test` (for example,
`toktickit_test`). Create that database once, for example with
`docker exec toktickit-postgres createdb -U toktickit toktickit_test`. Each
test creates and drops only a uniquely named temporary schema in that database.
The guard rejects other database names; no test runs `prisma migrate reset`.

To run the complete server suite, including inherited Lab 3 tests that read
`DATABASE_URL`, use `rtk npm run test:isolated --prefix server`. It requires
`TEST_DATABASE_URL`, prepares a temporary migrated schema in that test database,
runs Vitest with the child process's `DATABASE_URL` pointing to that schema,
and removes the schema afterwards. The application database is not used.

## Run locally

Start the API in one terminal:

```bash
cd server
npm run dev
```

Start the React app in another terminal:

```bash
cd client
npm run dev
```

Open <http://localhost:5173>, sign in with one of the documented local seed
accounts, and complete the mandatory password change. Requesters land on the
dashboard and can open My Tickets or a Ticket's detail page. IT Staff and
Administrators land on the staff dashboard, where they can open Ticket Queue,
review a Ticket, record Actions, and advance its status. Administrators can
open User Management from the account navigation.

The Lab 4 contracts, design, test plan, and peer-review evidence are in
[`docs/lab-04/`](docs/lab-04/). The Lab 4 E2E suites live at repository root in
[`e2e/lab-04/`](e2e/lab-04/); their screenshots are under
`artifacts/lab-04/screenshots/` in the dashboard and Actions Taken folders.

## Test and verification commands

Run these commands from the repository root. The isolated server and E2E
runners require `TEST_DATABASE_URL` to point to a disposable PostgreSQL
database whose name ends in `_test` (for example, `toktickit_test`). They create
and drop temporary schemas there; they do not use the development database.

```bash
rtk npm run test:isolated --prefix server -- --maxWorkers=1 --minWorkers=1
rtk npm run build --prefix server
rtk npm test --prefix client -- --reporter=dot
rtk npm run build --prefix client
rtk npm run test:e2e:isolated --prefix server
rtk git diff --check
```

The isolated server runner runs the full inherited Labs 1–3 regression suite
and the Lab 4 migration, seed, API, unit, and performance-smoke tests. The
isolated Playwright runner migrates and seeds its temporary schema, starts its
own API and client processes, and keeps discovery of the existing
`client/e2e/lab-02/` and `client/e2e/lab-03/` suites alongside
`e2e/lab-04/`. The browser flows exercise authentication, ownership, user
administration, Actions, Ticket status history, dashboards, keyboard use, and
responsive layouts; they write responsive captures under
`artifacts/lab-03/screenshots/` and `artifacts/lab-04/screenshots/`.

The complete Lab 3 contract and traceability records are in
[`docs/lab-03/specification.md`](docs/lab-03/specification.md),
[`docs/lab-03/api-spec.md`](docs/lab-03/api-spec.md),
[`docs/lab-03/ui-spec.md`](docs/lab-03/ui-spec.md), and
[`docs/lab-03/tests.md`](docs/lab-03/tests.md).
