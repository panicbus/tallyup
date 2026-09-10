import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // The staff member's own display name, set by them in Settings (a first
  // name is enough). Null until they fill it in; every UI that shows it
  // falls back to their email address.
  await sql`alter table staff add column name text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table staff drop column name`.execute(db);
}
