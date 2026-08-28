# TallyUp — domain glossary

Vocabulary for a multi-tenant digital loyalty punch-card platform. Use these
terms in code, tests, and issues; the "avoid" notes exist because the
alternatives are ambiguous in this domain, not because they read badly.

## Business

A single shop — the tenant. Every other record below belongs to exactly one.
Identified publicly by its **slug**, which appears in the check-in URL and is
therefore printed on physical signage: it is chosen once during onboarding and
is deliberately **not editable afterwards**, unlike name, reward threshold, and
reward description.

## Staff

A person who works at one Business and signs in (Supabase Auth) to confirm
check-ins and redemptions. Linked to their login by `staff.auth_user_id`. The
`role` column is stored (`'owner'` for whoever onboards the Business) but
nothing branches on it yet.

## Customer

Someone earning points at one Business, identified by phone number, normalized
to E.164. Scoped per Business — the same phone at two shops is two Customers
with independent balances. Staff-facing views only ever see a **masked phone**
(`•••-•••-4567`); the full number never leaves the server.

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
