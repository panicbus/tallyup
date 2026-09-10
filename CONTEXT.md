# TallyUp — domain glossary

Vocabulary for a multi-tenant digital loyalty punch-card platform. Use these
terms in code, tests, and issues; the "avoid" notes exist because the
alternatives are ambiguous in this domain, not because they read badly.

## Business

A single shop — the tenant. Every other record below belongs to exactly one.
Identified publicly by its **slug**, which appears in the check-in URL and is
therefore printed on physical signage: it is chosen once during onboarding and
is deliberately **not editable afterwards**, unlike name, reward threshold,
reward description, and logo.

The **logo** is optional. Its bytes never pass through the API — the browser
uploads them straight to Supabase Storage and sends back a URL, which the API
validates as belonging to that caller's own storage folder before storing it
(see [ADR-0001](docs/adr/0001-business-logo-storage.md)). Because it is shown
to Customers on the check-in page and punch card, it is publicly readable.

## Staff

A person who works at one Business and signs in (Supabase Auth) to confirm
check-ins and redemptions. Linked to their login by `staff.auth_user_id`. The
`role` column is `'staff'` or `'owner'` (`'owner'` for whoever onboards the
Business); owners can additionally change settings, manage Staff, and export
Customers. One account is active Staff at exactly one Business at a time,
enforced by a partial unique index on `staff.auth_user_id`. Removal is a soft
delete (`deactivated_at`), because a Staff member who ever confirmed anything
is referenced by Visit and Redemption rows.

## Invitation

How a new Staff member is added. An owner enters an email address and a
`role`; the API mints a single-use, 7-day, email-locked code (only its hash
is stored), emails a join link, and never returns the code. The recipient
opens the link, signs up or in with that exact address, and confirms; the
code is then consumed and a Staff row created (or a deactivated one at that
Business reactivated). Redeeming from an account whose email differs is
`wrong_account` and does **not** consume the code. Re-inviting the same
address supersedes the earlier invite. There is no "resend" beyond
re-inviting, and no way to change an existing Staff member's role. See
[ADR-0003](docs/adr/0003-email-invitations-via-resend.md).

## Customer

Someone earning points at one Business, identified by phone number, normalized
to E.164. Scoped per Business — the same phone at two shops is two Customers
with independent balances. Staff-facing views only ever see a **masked phone**
(`•••-•••-4567`). The public, unauthenticated check-in status poll (the
customer's own device) never receives a phone number at all — it already
knows its own — and only reports a confirmed result for a short window after
confirmation, since pending-checkin ids are never deleted.

## Pending check-in

A Customer's submitted-but-unconfirmed request to earn a point. Lives for 20
minutes. Resubmitting the same phone at the same Business refreshes the
existing row rather than creating a second one — one row per waiting Customer.

## Confirm — the fraud gate

The single most important operation: Staff turning a Pending check-in into a
Visit. It is one atomic, guarded transaction, so a Pending check-in can never
become a Visit twice or without Staff action. Expired and already-confirmed
both collapse into one `not_found` outcome — the caller has no reason to
distinguish them.

## Visit

A confirmed check-in. Worth exactly one point.

## Redemption

Spending points on the reward. Deducts the **reward threshold** and keeps the
remainder (rollover), one reward per action even when the remainder still
qualifies. `redemptions.threshold_applied` snapshots the threshold used,
because the threshold is editable; that snapshot is what keeps this invariant
closed:

    customers.points == count(visits) − sum(redemptions.threshold_applied)

Scoped per `(business_id, customer_id)`. Editing the threshold never
retroactively adjusts balances — eligibility simply recomputes, which means
lowering it can make Customers instantly eligible. That is intended, and the
settings UI says so.

## Tenant ownership

Which Business owns a given resource, and therefore whether a signed-in Staff
member may act on it. Distinct from authentication: *being signed in* is a
separate question (401) from *being signed in to the right Business* (403).
Enforced in two independent places — the `requireOwnership` guard at the route
layer, and composite foreign keys in the database, which reject a Staff member
confirming for a Business that isn't theirs regardless of what the routes do.

Avoid: "permissions", "roles" — neither describes this check, and `role`
already means something narrower above.

Every table also has Row Level Security enabled with no policies, which is a
separate layer from the above: it stops Supabase's public anon key (shipped in
the web bundle) from reaching any table directly through Supabase's own REST
API, regardless of what the Fastify API's own checks do. See
[ADR-0002](docs/adr/0002-enable-row-level-security.md).
