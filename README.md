# TokTickIT

TokTickIT is an IT service desk application built incrementally for CPE334.
This repository contains the Lab 1 full-stack foundation:

- `client/` — React, TypeScript, Vite, and Bootstrap
- `server/` — Node.js, Express, TypeScript, Prisma, and PostgreSQL
- `docs/lab-01/` — Lab 1 test, AI-use, and peer-review records

## Prerequisites

- Node.js 22 or later
- npm 10 or later
- PostgreSQL 16 or later, either locally or through Docker

## Initial setup

1. Install the frontend dependencies:

   ```bash
   cd client
   npm install
   ```

2. Install the backend dependencies:

   ```bash
   cd ../server
   npm install
   ```

3. Create local environment files from the committed templates. Do not commit
   the resulting `.env` files.

   ```bash
   cp client/.env.example client/.env
   cp server/.env.example server/.env
   ```

4. Choose one PostgreSQL setup:

   Local PostgreSQL: create a database named `toktickit` owned by a local
   user named `toktickit`, then use the default `DATABASE_URL` in
   `server/.env`.

   Docker PostgreSQL:

   ```bash
   docker run --name toktickit-postgres \
     -e POSTGRES_USER=toktickit \
     -e POSTGRES_PASSWORD=toktickit \
     -e POSTGRES_DB=toktickit \
     -p 5432:5432 \
     -v toktickit-postgres-data:/var/lib/postgresql/data \
     -d postgres:16
   ```

   If the container already exists, start it with `docker start
   toktickit-postgres` instead.

   Do not run both PostgreSQL instances on port `5432`. If port `5432` is
   already in use, stop the local service or change the Docker host port and
   the port in `server/.env` to match.

5. Prisma is initialized in `server/prisma/schema.prisma`. After the Category
   model is added, generate the client, apply the migration, and seed the
   database:

   ```bash
   cd server
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   ```

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

Open http://localhost:5173. Bootstrap is loaded by `client/src/main.tsx` and
is used by the initial page styling.

## Test commands

```bash
cd server && npm test
cd client && npm test
```

Later Lab 1 issues add the health endpoint, Category migration and seed, and
the complete system-check UI.
