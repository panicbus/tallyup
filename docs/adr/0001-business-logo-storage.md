# ADR-0001: Business logos upload browser-direct to Supabase Storage

- **Status**: Accepted
- **Date**: 2026-09-01

## Context

Businesses need to upload a logo, shown on the staff dashboard, the settings
page, the customer check-in page, and the customer punch card. Until now the
`LogoPicker` control existed but discarded the file — there was nowhere for
the bytes to go.

Three options were considered: the browser uploading straight to Supabase
Storage; the API receiving a multipart upload and forwarding it; or storing
the bytes in Postgres and serving them from a new API route.

## Decision

The browser uploads directly to a public Supabase Storage bucket
(`business-logos`) using the signed-in staff session and the existing anon
key. The API never handles image bytes — it receives the resulting URL,
validates it, and persists it in `businesses.logo_url`.

Object paths are `{authUserId}/{uuid}.{ext}`, keyed on the **Supabase Auth
user id**, not the business id. Each upload gets a fresh uuid.

The API validates every client-supplied URL against
`${SUPABASE_URL}/storage/v1/object/public/business-logos/{callerAuthUserId}/`
before storing it (`packages/api/src/services/logo-url.ts`).

## Rationale

**Why not server-proxied.** It would require adding `@fastify/multipart` and
putting `SUPABASE_SERVICE_ROLE_KEY` on Render — reversing a decision recorded
in three places (`.env.example`, `render.yaml`, `README.md`), each stating the
deployed API never needs that key. It would also route every image byte
through a free-tier dyno. Browser-direct needed **zero new dependencies and
zero new environment variables**.

**Why not bytes in Postgres.** It bloats every business row, needs a new
image-serving endpoint, and collides with Fastify's 1MiB default body limit.

**Why auth-user-keyed paths, not business-keyed.** Two reasons:

1. The storage access policy can be the stock Supabase form,
   `(storage.foldername(name))[1] = auth.uid()::text`, with no join to our own
   tables. A business-keyed path would need the policy to join `staff` — which
   is impossible in local development, where `DATABASE_URL` points at Docker
   Postgres while Storage is the hosted Supabase project. The app tables
   simply aren't in the same database as the storage policy engine.
2. The auth user exists *before* the business does, since signup precedes
   onboarding. That removes the chicken-and-egg problem entirely and is why
   the onboarding form can upload a logo before `POST /businesses` is called.

**Why a fresh uuid per upload.** A fixed overwrite path would mean replacing a
logo and then cancelling the form destroys the old image's bytes while the
database still points at that URL. Unique names also make URLs
self-cache-busting, avoiding a `?v=` timestamp against Supabase's CDN.

**Why validation is essential.** Since the bytes bypass the API, the URL is
attacker-controlled input. Without the check, a staff member could record an
arbitrary external host, or another shop's object, as their logo.

## Consequences

- **Orphaned objects accumulate.** Replaced and abandoned uploads are never
  deleted. Accepted deliberately at pilot scale (3–5 shops, small images), and
  consistent with the existing stance that expired pending check-ins are never
  cleaned up and there are no scheduled jobs.
- **One-time out-of-band setup is required** per Supabase project: a public
  `business-logos` bucket plus INSERT and UPDATE policies for `authenticated`
  using the folder expression above. Documented in the README's Deploying
  section. This is the same category of manual setup Auth already needed.
- **Local development writes to the real hosted bucket**, exactly as local
  development already authenticates against the real hosted Auth.
- **Residual risk, accepted**: the storage policy lets any authenticated user
  write into their *own* folder, so a signed-in staff member could upload junk
  there. They can never write to another shop's folder, and never get a
  foreign URL persisted, because the API's validation pins the path to their
  own auth user id. Tightening beyond this would require the service-role key
  and a signed-upload flow.
- If logos ever need to be private, or resized/optimized server-side, this
  decision would need revisiting — both imply the service-role key.
