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

## Status
W6 (staff auth) complete: staff sign in with email/password at `/login`
(Supabase Auth), and `/dashboard/:slug` requires a valid session — the
old staff-picker dropdown is gone, `confirmedBy` is now derived
server-side from the signed-in staff member. A staff member from one
business gets a 403 confirming/redeeming/reading another business's data
(enforced both at the route layer and by the DB's composite FKs).
`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are
required env vars now (see `.env.example`); Postgres itself stays local
via Docker Compose. `npm run db:seed` provisions a real demo staff login
(`demo-staff@example.com` / `tallyup-demo-password`) via the Supabase
admin API.
