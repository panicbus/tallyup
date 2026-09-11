import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // customers is unique on (business_id, phone), so business_id is the
  // leading column of that index and a bare `where phone = $1` (the public
  // punch-card lookup, W12) can't use it. This index backs that query.
  await sql`create index customers_phone_idx on customers (phone)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index customers_phone_idx`.execute(db);
}
