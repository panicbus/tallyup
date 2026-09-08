import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Closes the first real branching on `role` (requireOwner, shipped
  // earlier). Safe locally and must be preceded by a production pre-flight
  // (`select distinct role from staff`) before this migration ever runs
  // against the live database — a nonconforming row fails this statement.
  await sql`alter table staff add constraint staff_role_check check (role in ('owner', 'staff'))`.execute(db);

  // Soft-delete only: visits.confirmed_by / redemptions.confirmed_by have no
  // ON DELETE, so a staff member who ever confirmed anything cannot be hard
  // deleted. deactivated_by is nullable on purpose — the system doesn't
  // deactivate anyone on its own.
  await sql`alter table staff add column deactivated_at timestamptz`.execute(db);
  await sql`alter table staff add column deactivated_by uuid references staff (id)`.execute(db);

  // Replace the plain unique constraint with a partial one. A deactivated
  // row keeps its auth_user_id (never nulled — same "accept the lock-in"
  // call as onboarding's already_onboarded check, applied consistently)
  // but no longer occupies the uniqueness slot, so that person can be
  // invited to a different business once no longer active at this one.
  // Redeeming a new invite for the SAME business instead reactivates the
  // existing deactivated row (see staff-port.ts) — this index is never
  // exercised by that path, only by the cross-business case.
  await sql`alter table staff drop constraint staff_auth_user_id_key`.execute(db);
  await sql`
    create unique index staff_active_auth_user_id_key on staff (auth_user_id)
      where deactivated_at is null
  `.execute(db);

  await sql`
    create table staff_invites (
      id uuid primary key default gen_random_uuid(),
      business_id uuid not null references businesses (id),
      -- Only the hash is stored — the plaintext code is a bearer credential
      -- granting access to this business, treated like a password-reset
      -- token. Never logged, never retrievable after creation.
      code_hash text not null unique,
      role text not null check (role in ('owner', 'staff')),
      created_by uuid not null references staff (id),
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      redeemed_at timestamptz,
      redeemed_by uuid references staff (id)
    )
  `.execute(db);

  // See ADR-0002 / migration 0010: every public table needs RLS, or it's
  // reachable through Supabase's PostgREST API via the public anon key. A
  // missing RLS statement here specifically would be a full tenant
  // takeover — anyone could insert a role:'owner' invite for any business.
  await sql`alter table staff_invites enable row level security`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table staff_invites`.execute(db);
  await sql`drop index staff_active_auth_user_id_key`.execute(db);
  await sql`alter table staff add constraint staff_auth_user_id_key unique (auth_user_id)`.execute(db);
  await sql`alter table staff drop column deactivated_by`.execute(db);
  await sql`alter table staff drop column deactivated_at`.execute(db);
  await sql`alter table staff drop constraint staff_role_check`.execute(db);
}
