# TokTickIT

TokTickIT is an IT service desk application built incrementally for CPE334.
Lab 3 replaces the Lab 2 development requester selector with authenticated,
role-based workspaces:

- `client/` — React, TypeScript, Vite, Bootstrap, and Playwright
- `server/` — Node.js, Express, TypeScript, Prisma, PostgreSQL, and Vitest/Supertest
- `docs/lab-01/`, `docs/lab-02/`, and `docs/lab-03/` — contracts, test plans,
  AI-use reflections, and peer-review records
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

   The seed is idempotent and creates four active Requesters, an inactive
   Requester, three active IT Staff accounts, an inactive IT Staff account, an
   active Administrator, reference data, realistic Tickets, a Public Comment,
   and an Internal Note. Every seeded account starts with the disposable local
   password `Lab3-Initial-2026!` and must change it at first sign-in. Seeded
   credentials are for local development only; they are not production secrets.

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
