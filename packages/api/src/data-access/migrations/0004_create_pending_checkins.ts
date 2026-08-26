import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table pending_checkins (
      id uuid primary key default gen_random_uuid(),
      business_id uuid not null references businesses (id),
      phone text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      -- resubmitting a phone that already has a row (pending or expired,
      -- since expired rows are never swept) upserts on this constraint
      -- rather than creating a second queue entry.
      unique (business_id, phone)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table pending_checkins`.execute(db);
}
