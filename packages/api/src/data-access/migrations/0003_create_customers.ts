import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table customers (
      id uuid primary key default gen_random_uuid(),
      business_id uuid not null references businesses (id),
      phone text not null,
      points integer not null default 0 check (points >= 0),
      created_at timestamptz not null default now(),
      unique (business_id, phone),
      -- lets visits/redemptions FK against (customer_id, business_id) as a
      -- pair, so the database rejects a visit/redemption whose customer
      -- belongs to a different business than the row claims.
      unique (id, business_id)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table customers`.execute(db);
}
