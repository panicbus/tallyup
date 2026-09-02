# ADR-0002: Enable Row Level Security on every table, with no policies

- **Status**: Accepted
- **Date**: 2026-09-02

## Context

Supabase's Security Advisor flagged all eight `public` schema tables
(`businesses`, `staff`, `customers`, `pending_checkins`, `visits`,
`redemptions`, and Kysely's own `kysely_migration` /
`kysely_migration_lock`) as "publicly accessible": RLS was off, and Supabase
auto-exposes every `public` table through its PostgREST API.

That API accepts the project's `anon` key, which is not a secret — it's
`VITE_SUPABASE_ANON_KEY`, bundled into the deployed web app and extractable by
anyone who opens it. With RLS off, that key could read, write, or delete every
row in every table directly at `https://<project>.supabase.co/rest/v1/...`,
completely bypassing the Fastify API's own auth (`requireAuthenticatedIdentity`
/ `requireStaff` / `requireOwnership`) and the composite-FK tenant scoping
described in [CONTEXT.md](../../CONTEXT.md#tenant-ownership). This was a live
gap in production, not a theoretical one.

## Decision

Enable RLS on all eight tables and add **no policies**
(`packages/api/src/data-access/migrations/0010_enable_row_level_security.ts`).

This is safe because the app never queries these tables through PostgREST.
The Fastify API's only path to Postgres is `DATABASE_URL` — in production, the
Supabase project's own Postgres connection string, the same one every prior
migration used to create these tables. Postgres lets a table's **owner**
bypass RLS regardless of what policies exist (confirmed locally:
`relforcerowsecurity = f` after this migration, and the full integration
suite — 72 tests — passes unchanged). RLS-with-no-policies therefore changes
nothing for the API; it only removes the default-allow that `anon` and
`authenticated` — the roles PostgREST runs as — previously had.

## Rationale

**Why not write policies instead of leaving the table policy-less.** No
client ever legitimately reads these tables through Supabase's REST API — the
web app talks to the Fastify API, never `supabaseClient.from(...)`. There is
no access pattern to write a policy *for*. A policy would be dead code
standing in for "deny," when RLS-enabled-with-zero-policies already means
exactly that.

**Why not scope this to just the app's six tables.** Kysely's own
`kysely_migration` / `kysely_migration_lock` were flagged by the same
advisor for the same reason — they're `public` schema tables like any other,
and there's no argument for leaving migration bookkeeping readable by the
anon key when nothing else is.

## Consequences

- **No behavior change for the API or any test.** Verified locally: migration
  applied cleanly, `relrowsecurity = t` / `relforcerowsecurity = f` on all
  eight tables, and `npm run test:integration -w @tallyup/api` passed 72/72
  unchanged.
- **Must be applied to production separately**, the same manual step every
  prior migration needed: `DATABASE_URL="<supabase-connection-string>" npm run
  db:migrate` per the README's Deploying section. Local Docker Postgres and
  the hosted Supabase Postgres are separate databases; this migration was only
  a live fix once run against the latter.
- **If a future feature ever needs the browser to query Supabase tables
  directly** (bypassing the Fastify API), this decision must be revisited —
  it would need real policies, not zero policies, at that point.
