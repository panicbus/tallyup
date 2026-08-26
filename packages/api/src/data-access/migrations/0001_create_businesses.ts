import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table businesses (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text not null unique,
      reward_threshold integer not null check (reward_threshold > 0),
      reward_description text not null,
      created_at timestamptz not null default now()
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table businesses`.execute(db);
}
