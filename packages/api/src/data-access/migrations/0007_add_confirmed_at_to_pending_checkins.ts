import { Kysely, sql } from 'kysely';

// confirmCheckin no longer deletes this row on confirm (W2's original
// design) — it marks it instead, so the customer-facing status poll (W5)
// has something to find after confirmation. The guarded UPDATE using this
// column (`WHERE confirmed_at IS NULL`) is the fraud gate now, same
// atomicity guarantee as the delete it replaces.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table pending_checkins add column confirmed_at timestamptz`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table pending_checkins drop column confirmed_at`.execute(db);
}
