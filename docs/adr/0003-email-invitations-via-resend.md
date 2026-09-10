# ADR-0003: Staff invitations are sent by email through Resend

- **Status**: Accepted
- **Date**: 2026-09-10

## Context

Adding a teammate used to mean the owner generated a 32-character invite
code, copied it, sent it out of band, and the new hire pasted it into a
"Join with a code" tab on `/onboarding` after making an account. It worked
but was fiddly, and the recipient had no idea what the string was.

The intended flow: the owner types a teammate's email and role, the app
emails an invitation link, the recipient clicks it, signs up or in, and
lands in the shop.

That needs the API to send a transactional email, which it has never done.

## Decision

Add an outbound `EmailPort` (`packages/api/src/data-access/email-port.ts`),
following the same fake/real split as `AuthPort`. The real adapter
(`resend-email-port.ts`) is a plain `fetch` POST to
`https://api.resend.com/emails` with a 10s timeout — no SDK dependency. A
console adapter (`console-email-port.ts`) logs the link to stdout and is the
fallback when `RESEND_API_KEY` is unset, so the whole flow runs locally with
no Resend account; `main.ts` refuses that fallback when `NODE_ENV` is
`production`.

New env vars: `RESEND_API_KEY` and `RESEND_FROM` (required in production),
and `APP_URL` (optional, defaults to `CORS_ORIGIN`, used to build the link).

`staff_invites` gains an `email` column (migration 0013). Redemption
requires the signed-in account's email to match it (`wrong_account`
otherwise, invite not consumed). `POST /businesses/:slug/invites` takes
`{ email, role }`, sends the email, and never returns the plaintext code. A
new unauthenticated `POST /invites/lookup` returns the shop, slug, inviter,
role, and invited address for the join page's confirmation card.

The link does **not** redeem on arrival — the join page shows a confirm
button. New hires sign up inline with the email locked to the invited
address.

## Rationale

**Why not Supabase's own `auth.admin.inviteUserByEmail`.** It would require
putting `SUPABASE_SERVICE_ROLE_KEY` on Render, reversing a decision recorded
in three places (`.env.example`, `render.yaml`, `README.md`), each stating
the deployed API never needs that key — the same reasoning ADR-0001 used to
reject a server-proxied upload. It also couples the invite lifecycle (roles,
revocation, the reactivate-a-deactivated-row path) to Supabase's user model
instead of our own `staff_invites` table.

**Why a plain `fetch`, no SDK.** One endpoint, one request shape. An SDK
would be a dependency for no gain, and the adapter already translates every
failure to the port's `{ outcome: 'failed'; reason }` at the boundary.

**Why the link does not auto-redeem.** Corporate mail scanners and link
prefetchers fetch URLs in emails; an auto-redeeming link would be spent
before the human clicked. The confirm step also lets the page show who
invited them and to what. And it is what makes both Supabase email-
confirmation settings survivable: with confirmation on, sign-up returns no
session, so redemption simply waits for a second visit instead of breaking.

**Why the invite is locked to the invited address.** It is an access-
granting credential. A forwarded link must not let a different account join,
and the mismatch must not consume the invite, so the real recipient can
still use it.

**Why supersede-on-create.** Only the hash is stored, so "resend" is
impossible without re-minting — which means re-minting *is* resend.
Creating a second invite for the same address at the same business retires
the first, giving a working resend, no duplicate pending rows, and no stale
link after a typo correction.

**Why revoke-on-send-failure.** A pending invite the owner believes was
emailed but was not is the worst state. The compensating revoke is wrapped
so that if it also fails, the send failure is still what the owner hears.

**Why `POST` for the lookup, not `GET /invites/:token`.** Fastify logs
request URLs; a bearer code in the path or query string would land in
Render's logs. `POST` with the code in the body keeps it out of server-side
logs. (It is unavoidably in the recipient's browser history — the same
posture as Supabase's own password-reset links.)

**Why rate-limit `POST /businesses/:slug/invites`.** It now sends email to
an arbitrary address on any owner's say-so, so it is a spam vector aimed at
the sending domain's reputation, which no later code change can repair. The
limiter runs before the auth preHandlers, so the key is the caller's IP, not
their business — coarse, but adequate at pilot scale.

## Consequences

- **Two env vars are now required in production** (`RESEND_API_KEY`,
  `RESEND_FROM`), and the API crashes at boot without the key rather than
  failing mid-request. `APP_URL` is a third, optional one. This is a real
  cost that ADR-0001 was written partly to avoid; it is accepted here
  because email delivery has no zero-dependency form.
- **One-time out-of-band setup**: a verified sending domain in Resend (DNS
  records), and Supabase "Confirm email" left off. Documented in the
  README's Deploying section, the same category as ADR-0001's storage
  bucket.
- **Changing someone's role is still unsupported.** An owner who re-invites
  an existing teammate to promote them gets `already_staff`; there is no
  promote path. The Staff page warns client-side when the typed address is
  already on the roster. A dedicated role-change flow is future work.
- **The copy-a-code UI is gone.** `JoinWithCodeForm` and the "Join with a
  code" mode on `/onboarding` were removed. Migration 0013 retires the 10
  outstanding code-flow invites (setting `redeemed_at`), since they can no
  longer be redeemed.
- **Residual risk, accepted**: `POST /invites/lookup` is unauthenticated and
  returns the invitee's email address to whoever holds the link. This is
  necessary — the join page locks its sign-up field to that address — and
  the link is a 192-bit unguessable token. A leaked link already grants far
  more (it can be redeemed by an account with that address), so the email
  disclosure does not widen the exposure.
- If Supabase "Confirm email" is ever turned on, the flow degrades to a
  two-visit path (`confirm_pending` on the join page) rather than breaking.
  This is the property the no-auto-redeem decision buys.
