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
    cp .env.example .env   # if you don't already have one

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

## Status
W1 (schema & migrations) complete: six tables, business_id-scoped composite
FKs, seed script. No routes, no auth, no UI logic yet.
