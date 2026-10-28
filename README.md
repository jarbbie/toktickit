# TokTickIT

TokTickIT is an IT service desk application built incrementally for CPE334.
Lab 3 replaces the Lab 2 development requester selector with authenticated,
role-based workspaces:

- `client/` — React, TypeScript, Vite, Bootstrap, and Playwright
- `server/` — Node.js, Express, TypeScript, Prisma, PostgreSQL, and Vitest/Supertest
- `docs/lab-01/` through `docs/lab-04/` — contracts, test plans, AI-use
  reflections, and peer-review records
- `artifacts/lab-03/screenshots/` — browser evidence captured by the Lab 3 E2E suite

The three supported roles are Requester, IT Staff, and Administrator. Requesters
create and track their own Tickets; IT Staff use the shared queue and Ticket
Detail workflow; Administrators manage accounts and initial passwords. The
server enforces ownership and role authorization independently of the UI.

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
accounts, and complete the mandatory password change. The application now
starts at Login; the former Development Requester selector is not part of Lab 3.

## Test and verification commands

Run these commands from the repository root:

```bash
npm test --prefix server
npm run build --prefix server
npm test --prefix client
npm run build --prefix client
npm run test:e2e --prefix client
git diff --check
```

The Playwright configuration seeds the local database, runs the authenticated
Lab 2 regression and Lab 3 Login, Requester, IT Staff, Administrator, and
responsive flows, and writes readable evidence under
`artifacts/lab-03/screenshots/`. Use a disposable local database for E2E runs;
the flows create test Tickets and one temporary Administrator-managed account.

The complete Lab 3 contract and traceability records are in
[`docs/lab-03/specification.md`](docs/lab-03/specification.md),
[`docs/lab-03/api-spec.md`](docs/lab-03/api-spec.md),
[`docs/lab-03/ui-spec.md`](docs/lab-03/ui-spec.md), and
[`docs/lab-03/tests.md`](docs/lab-03/tests.md).
