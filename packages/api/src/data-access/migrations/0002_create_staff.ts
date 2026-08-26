import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table staff (
      id uuid primary key default gen_random_uuid(),
      business_id uuid not null references businesses (id),
      email text not null,
      role text not null,
      created_at timestamptz not null default now(),
      -- lets visits/redemptions FK against (staff_id, business_id) as a pair,
      -- so the database rejects a staff member confirming for a business
      -- that isn't their own.
      unique (id, business_id)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table staff`.execute(db);
}
