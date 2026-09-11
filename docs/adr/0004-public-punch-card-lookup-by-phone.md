# ADR-0004: Customers can look up their punch balance by phone number

- **Status**: Accepted
- **Date**: 2026-09-11

## Context

A customer could only ever see their punch count in one place: the check-in
screen, immediately after staff confirm it, for a five-minute window
(`CONFIRMED_STATUS_VISIBILITY_MS`, `kysely-check-in-port.ts`). There was no
way to check a balance before deciding whether a visit was worth it, which was
the most requested missing feature.

Two shapes were considered for closing that gap:

1. **Full customer accounts.** Customers have no email today, so this means
   phone OTP via Supabase, which means Twilio and A2P 10DLC registration
   (carrier-required for US SMS) — weeks of work, and gated on the same
   unbuilt infrastructure as the texting feature `sms_consents` already
   collects consent for.
2. **A public, unauthenticated phone-number lookup.** Type a number at
   `hellotallyup.com/card`, see every shop that number has points at.

## Decision

Ship the lookup: `POST /cards/lookup` takes a phone number and returns
`CustomerCardBalance[]` — one entry per business the number has any customer
row at, containing everything already public through `GET /businesses/:slug`
plus the point balance. An unknown number returns `200 { cards: [] }`, never a
404. The web page at `/card` remembers the last looked-up number in
`localStorage` so returning to it (a bookmark, a home-screen icon) works
without retyping.

This deliberately **reverses a documented posture**: `CONTEXT.md`'s Customer
section and `CheckinStatusCustomer`'s doc comment
(`check-in-port.ts`) both state that a public response must not carry
anything an id-holder shouldn't be able to read back out, and every other
public route is keyed by a non-sensitive slug or an unguessable id/token. A
phone number is guessable. That tradeoff is accepted, bounded, and disclosed
below and in the Privacy Policy, rather than left implicit.

## Rationale

**Why not customer accounts first.** Phone OTP needs Twilio and carrier
registration that doesn't exist yet, and building it just to gate this lookup
would block a requested feature behind unrelated infrastructure work for
weeks. The lookup below is the interim step; accounts (or OTP-gating the
lookup itself) remain the eventual upgrade once that infrastructure exists.

**Why not a device-remembered unguessable card token instead**, e.g. handing
the browser `customers.id` at confirm time and listing every remembered shop
from `localStorage`. It adds no new exposure — the token is a 122-bit UUID,
not a public identifier — but it only starts working after a customer's
*next* check-in, is lost entirely on a new device, and iOS Safari's
Intelligent Tracking Prevention evicts script-writable storage after 7 days
with no visit to the site (bookmarking or adding to the home screen exempts
it, but nothing forces a customer to do that). The phone lookup works
immediately for every customer who already has a punch history, on any
device, which is the point of the feature. If customer accounts or SMS OTP
ship later, this token approach — or gating the phone lookup behind an SMS
code, using the consent-collection infrastructure `sms_consents` already
has — is the natural next step, not a replacement for this ADR's decision.

**Why the real threat is targeted, not bulk enumeration, and why the
mitigation is response minimization, not just rate limiting.** At the house
rate limit of 10/minute per IP, sweeping a full area code (10 million
numbers) costs on the order of 700 IP-days — bulk harvesting is expensive
enough that the limit does real work against it. It does nothing against
someone who already has a specific number in hand: they only need one
request. That case can't be rate-limited away, so the response itself is
minimized instead — a business name, slug, logo, reward terms (all already
public), and a point count. No name, no address, no visit history, no
contact detail, no confirmation of anything beyond the count.

**Why `POST`, not `GET /cards/:phone`.** Same reasoning as `POST
/invites/lookup` (ADR-0003): Fastify logs request URLs, so a phone number in
a path or query string would land in Render's logs. `cache-control: no-store`
for the same reason applied to caches in between.

**Why an empty array instead of a 404.** "Not a customer anywhere" and "a
customer with nothing to show" must be the same response from outside — the
same anti-enumeration reasoning as `POST /customers/:id/redeem`'s
`missing: 'allow'`.

**Why one migration, an index only.** `customers` is unique on
`(business_id, phone)`, so `business_id` is the leading column of that index
and a bare `where phone = $1` can't use it. `customers_phone_idx` (migration
0015) backs the lookup. No new table, so no new RLS statement — the index
inherits the table's.

## Consequences

- **A phone number is now a working key against the API**, where before every
  public route was keyed by a slug or an unguessable id. This is the
  headline tradeoff of this ADR, not a side effect: anyone who already knows
  a customer's number can learn which of the pilot shops they visit and how
  often. Said plainly on the `/card` page itself, next to the phone field,
  and in the Privacy Policy.
- **The 10/minute-per-IP rate limit is a speed bump against bulk sweeps, not
  a defense against a targeted lookup of one known number.** No rate limit
  can be, against a single request.
- **There is no customer opt-out from the lookup.** A customer who wants
  their business excluded from it has no self-service path today (the same
  gap as the Privacy Policy's existing, currently-unimplemented "ask to have
  your number removed" promise). Noted as a known gap, not solved here.
- **Two pre-existing Privacy Policy inaccuracies were fixed in the same
  pass**, since they sit next to the copy this feature required touching
  anyway: the "masked everywhere except the moment of check-in" line didn't
  describe the SMS-consent carve-out that shows a full number on the roster
  and CSV export, and the "ask to have your number removed" line promised a
  delete path that doesn't exist in the API.
