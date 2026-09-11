# TallyUp — project handoff

_Last updated: 2026-09-11_

Digital loyalty punch-card SaaS, pitch-readiness pass for a small-business
pilot (3–5 shops). Solo project, built with Claude Code. Repo:
`/Users/Crisafulli/Documents/TallyUp`, npm workspaces monorepo, branch
`main`.

## Stack & layout

- **`packages/shared`** (v0.2.0) — TS types + Zod schemas (`phone.ts`,
  `email.ts`), ships as source, no build, imported by both other packages.
- **`packages/api`** (v0.7.0) — Fastify + TypeScript + Kysely + Postgres,
  `tsx` (no compile step, even in prod). Layered
  `routes/ → services/ → data-access/`.
- **`packages/web`** (v0.2.0) — React 19 + Vite, TypeScript, mobile-first, no
  design system.
- Node 22.12+, npm 10+, Docker for local Postgres (`npm run db:up`).
- Full test suite as of this writing: **528 tests / 63 files, all green**
  (`npm test` at root). `npm run typecheck` clean.

## Architecture conventions (load-bearing — follow these)

- **Port/adapter pattern**: every external dependency (DB queries, auth,
  email) is an interface (`*-port.ts`) with a real Kysely/fetch adapter and
  an in-memory fake (`test-support/in-memory-*.ts`). Query-shaped ports
  (`CheckInPort`, `StaffPort`) additionally get a **shared contract-test
  suite** (`*-port-contract.ts`) run once against the fake and once against
  real Postgres, so the two can't drift. Every contract test body must
  literally destructure `{ realDb }` in its callback signature — Vitest
  parses that statically to decide which fixtures to build.
- **Outbound-service ports** (`AuthPort`, `EmailPort`) are interface + thin
  vendor wrapper + fake only, **no contract suite** — config passed as
  arguments, never read from `process.env` inside the adapter.
- **Three test tiers**: (1) pure service unit tests, ports narrowed with
  `Pick<Port, 'method'>`; (2) route tests with a per-file local
  `buildTestApp()` using `db: createDb('postgres://unused')`; (3)
  `*.integration.test.ts` against real Postgres via `db` (auto-rollback
  transaction) / `realDb` (non-transactional, needed by anything that opens
  its own `.transaction()`) fixtures from `test-support/integration-test.ts`.
- **Auth guard chain**: `requireAuthenticatedIdentity` (401) →
  `requireStaff` (401) → `requireOwner` (403) →
  `requireOwnership(resolver)` (403/404). 401 = not signed in, 403 = signed
  in to the wrong business, 404 = unknown resource, 409 = a business-rule
  refusal.
- **Error-body convention**: every error reply is
  `reply.code(N).send({ error: 'snake_case' })`, mirroring the port's
  outcome discriminant one-to-one.
- **Migrations**: raw `sql` template literals in
  `packages/api/src/data-access/migrations/NNNN_*.ts`, `up`/`down`, applied
  to prod manually
  (`DATABASE_URL="<supabase-conn>" npm run db:migrate`). **Every new table
  must `enable row level security`** (ADR-0002 — RLS with zero policies; the
  app connects as table owner via `DATABASE_URL` and bypasses it, this only
  blocks Supabase's public anon key from reaching tables directly via
  PostgREST). `packages/api/src/data-access/types.ts` is hand-maintained,
  not generated.
- **Versioning**: only `packages/api/package.json` gets bumped; the commit
  subject carries `(vX.Y.Z)`; web-only commits skip the bump.
- **Writing rule, enforced by a hook**: no em dashes or en dashes (`—`/`–`)
  in user-facing copy anywhere under `packages/*/src` —
  `.claude/hooks/no-em-dash.sh` blocks the commit (comments and tests are
  exempt). Recast the sentence; don't just swap the character.
- Domain vocabulary lives in `CONTEXT.md` (Business, Staff, Invitation,
  Customer, Pending check-in, Confirm/fraud gate, Visit, Redemption, Tenant
  ownership) — read it before touching domain logic. Decisions with lasting
  rationale go in `docs/adr/` (currently 4: business-logo storage, RLS,
  email invitations, public phone lookup).

## What's built (roughly chronological)

1. **Core loop**: business onboarding, `/checkin/:slug` (customer submits
   phone → pending check-in → staff confirms → point), redemption with
   threshold rollover, QR code, CSV export, dashboard stats.
2. **Pitch-readiness pass**: landing page, password reset, legal pages
   (Terms/Privacy), no-em-dash enforcement, mobile polish, persistent
   check-in results.
3. **Staff email invitations** (replacing a copy-paste code flow) — owner
   types an email + role, gets emailed a join link, recipient signs up/in
   inline and lands as staff. Built via `EmailPort` (Resend, plain `fetch`,
   no SDK; console fallback in dev). See ADR-0003. Known gap: **no
   role-change/promote path** — re-inviting an existing teammate hits
   `already_staff`.
4. **Staff permissions model**: `role` is `'owner' | 'staff'` (DB CHECK
   constraint, never neither). Staff get a read-only Staff tab, a
   per-account display name (editable only in Settings' Edit view,
   owner-only), a profile-menu avatar with Owner/Staff label, mobile
   hamburger nav. Owner-only: Settings edit, invite form, deactivate.
5. **UI polish round**: wider Customers table, full-width mobile auth,
   reset-password eye icon, About modal (with Ko-fi link, Terms/Privacy
   links), demo check-in hardening (never writes to the real queue),
   landing-page auto-redirect to dashboard for a signed-in staff member,
   1-month sliding Supabase session.
6. **Public phone-number punch-card lookup** (v0.7.0): a customer can check
   their balance at every shop *before* visiting, at `/card` — type a phone
   number, see shop name / reward terms / point count per shop, no login.
   Backed by `POST /cards/lookup` (public, 10/min per-IP rate limit,
   `cache-control: no-store`, unknown number returns `[]` never 404). This
   is a **deliberate reversal** of the app's usual "public routes are keyed
   by unguessable ids" posture — a phone number is guessable — mitigated by
   minimizing what the response discloses (no name, no phone echoed back, no
   visit history). See ADR-0004 and `CONTEXT.md`'s Customer section for the
   full reasoning. Web side remembers the number in localStorage so a
   bookmarked `/card` doesn't require retyping.

## Deploy status

- **Not yet confirmed live** as of the README's own "Status" section (though
  ADR-0003's context implies deploy work and DMARC/spam troubleshooting
  happened — verify with the user whether Render/Vercel are actually live
  now, since deploy discussions occurred but the README hasn't been updated
  to reflect a completed launch).
- `render.yaml` (api) and `packages/web/vercel.json` (web, SPA rewrite) are
  in place and correct.
- Local `.env`: `DATABASE_URL`, `TEST_DATABASE_URL`, `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PROD_DATABASE_URL` are
  all set. **`RESEND_API_KEY` and `RESEND_FROM` are empty locally** (correct
  for dev — falls back to the console email port — but must be set in the
  Render dashboard for prod; the api hard-crashes at boot in production
  without `RESEND_API_KEY`).
- Prod DB is reachable via `PROD_DATABASE_URL` in `.env`, and there's also a
  configured Supabase MCP connection for direct read/write access to it
  (note the VS Code "Reload Window" gotcha after any MCP config change).

## Known standing gaps / not-yet-done

- **Supabase dashboard**: Authentication → Sessions → Inactivity timeout
  should be set to `720` hours (30 days), Time-box left empty. Documented in
  the README as a deploy step; unconfirmed whether it's actually been set in
  the dashboard.
- **DMARC TXT record** (`_dmarc`, `v=DMARC1; p=none; rua=mailto:...`) at the
  Vercel DNS for the sending domain — was recommended to fix invite-email
  spam classification; unconfirmed whether it's been added.
- **`CORS_ORIGIN`** is a single string; multi-origin support (comma-list)
  was floated but never built.
- **Role change (promote/demote) is unsupported** — recorded as a known gap
  in ADR-0003.
- **`/card` phone lookup has no rate-limit-beyond-IP defense** against
  someone targeting one already-known number — accepted risk, documented in
  ADR-0004, not a bug.
- Two pre-existing Privacy-policy inaccuracies were fixed in the last commit
  (SMS-consent carve-out disclosure, dropped the false "we can delete your
  number" promise) — worth double-checking no other copy/reality mismatches
  remain.

## Dev environment (at last check)

- Local Postgres (Docker) is up.
- API dev server (`npm run dev -w @tallyup/api`) and web dev server
  (`npm run dev -w @tallyup/web`) were live at `http://localhost:3000` and
  `http://localhost:5173`. Restart both if starting a fresh session.
