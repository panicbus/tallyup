# TallyUp

Multi-tenant digital loyalty punch-card platform (pilot: 3–5 shops).

## Packages
- `packages/shared` — TypeScript types + Zod schemas, single source of truth for
  data shapes, imported by both `api` and `web`.
- `packages/api` — Fastify + TypeScript. Layered: routes -> services -> data access.
- `packages/web` — React + Vite, TypeScript, mobile-first, no design system yet.

## Requirements
Node 22.12+, npm 10+, Docker (for local Postgres).

## Install
    npm install
    cp .env.example .env                       # if you don't already have one
    cp packages/web/.env.example packages/web/.env

Both `.env` files need a Supabase project's Auth credentials — Project
Settings -> API in the Supabase dashboard. Local dev/test Postgres stays on
Docker Compose regardless; Supabase here is Auth only.

## Database
Local Postgres via Docker Compose — one `tallyup_dev` database for `npm run
dev`/seeding, one `tallyup_test` database the integration test suite
migrates and uses automatically.

    npm run db:up           # start Postgres (docker compose up -d)
    npm run db:migrate      # apply migrations to tallyup_dev
    npm run db:seed         # idempotent: creates one demo business
    npm run db:down         # stop Postgres

Test migrations run automatically (Vitest `globalSetup`) — no manual step
needed before `npm test`, just `npm run db:up` first.

## Tests
TDD loop — keep watch mode running while you work; run the full suite before
moving on. Requires Postgres running (`npm run db:up`) since api's
integration project touches a real database.

    npm run test:watch      # watch mode, all packages
    npm test                # single run, all packages (CI-style)
    npm run typecheck       # tsc --noEmit, all packages

Single package:

    npm test -w @tallyup/api              # api's fast unit tests only
    npm run test:integration -w @tallyup/api   # api's DB-backed integration tests
    npm test -w @tallyup/web
    npm test -w @tallyup/shared

## Dev servers
Two separate processes — run each in its own terminal:

    npm run dev -w @tallyup/api      # Fastify on http://localhost:3000 (tsx watch)
    npm run dev -w @tallyup/web      # Vite on http://localhost:5173

`api` allows CORS from `http://localhost:5173` by default (override with the
`CORS_ORIGIN` env var — W7 deploy points this at the real Vercel URL). `web`
calls the API at `http://localhost:3000` by default (override with
`VITE_API_URL` in `packages/web/.env`).

After seeding (`npm run db:seed`), the demo business's pages are at:

    http://localhost:5173/dashboard/demo-bookstore   # staff
    http://localhost:5173/checkin/demo-bookstore     # customer

## Deploying
`api` on Render, `web` on Vercel, Postgres on the same Supabase project
already used for Auth. `api` and `web` each need to know the other's URL
(`CORS_ORIGIN`, `VITE_API_URL`), so deploy in this order to avoid a
chicken-and-egg wait:

1. **Migrate the production database once**, from your machine, pointed at
   Supabase instead of Docker:

       DATABASE_URL="<supabase-connection-string>" npm run db:migrate

   Get the connection string from the Supabase dashboard: Project Settings
   -> Database -> Connection string -> **Transaction pooler** URI (not the
   direct connection — Render's compute is ephemeral/serverless-adjacent,
   and the pooler is what Supabase recommends for that). Don't run
   `db:seed` against production — real shops onboard themselves via
   `/signup`, there's no need for a seeded demo business there.

   **Also create the logo storage bucket once**, in the same Supabase
   project (Storage -> New bucket): name it `business-logos` and mark it
   **public**. Then add two policies on it, both targeting the
   `authenticated` role, one for `INSERT` and one for `UPDATE`, sharing
   this definition:

       bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text

   That confines each signed-in user to writing inside a folder named for
   their own auth user id, which is the path scheme
   `packages/api/src/services/logo-url.ts` validates against. No SELECT
   policy is needed — public read comes from the bucket's public flag. See
   [ADR-0001](docs/adr/0001-business-logo-storage.md) for why logos upload
   browser-direct rather than through the api. Local development uses this
   same hosted bucket, exactly as local Auth uses the hosted Auth server.

2. **Render** (api): New -> Blueprint, connect this repo — `render.yaml` at
   the root defines the service. It'll prompt for four env vars:
   `DATABASE_URL` (from step 1), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (same
   values as your local `.env`), and `CORS_ORIGIN` (leave as a placeholder
   like `http://localhost:5173` for now — you'll fix it in step 4). Once
   live, confirm `https://<your-service>.onrender.com/health` returns
   `{"status":"ok"}`.

3. **Vercel** (web): New Project, import this repo, set **Root Directory**
   to `packages/web` (Vercel auto-detects the npm workspace and installs
   from the true repo root regardless). Framework preset (Vite) and build
   output are auto-detected; `packages/web/vercel.json` adds the SPA
   rewrite client-side routing needs. Env vars: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (same as local), and `VITE_API_URL` set to the
   Render URL from step 2.

4. **Go back to Render** and update `CORS_ORIGIN` to the real Vercel URL
   (no trailing slash). Changing an env var triggers an automatic
   redeploy.

5. **Smoke test**, for real: visit the Vercel URL, sign up, complete
   onboarding, open the resulting `/checkin/:slug` link in a second
   tab (or scan the QR code with a phone), submit a check-in, and confirm
   it from the dashboard tab — the full loop, on the actual deployed
   infrastructure.

## Status
W7 (deploy) config complete: `render.yaml` (api) and `packages/web/vercel.json`
(web, SPA rewrite) are in place, `api`'s start script no longer depends on a
compiled `dist/` (`@tallyup/shared` ships TS source, so production runs the
same `tsx`-based entrypoint dev does — a plain `tsc` build can't resolve it).
See "Deploying" above. Live deploy itself is a manual dashboard step and
hasn't happened yet as of this note.
