import { Kysely, sql } from 'kysely';

// No policies follow on purpose. The api never talks to Postgres through
// Supabase's PostgREST layer — it connects with DATABASE_URL, the same
// connection every prior migration used to create these tables, so it owns
// them and Postgres lets a table's owner bypass RLS regardless of policies.
// The only thing RLS-with-no-policies changes is that the `anon` and
// `authenticated` roles PostgREST runs as — reachable by anyone holding the
// public VITE_SUPABASE_ANON_KEY shipped in the web bundle — now get denied
// by default instead of the wide-open access Supabase gives an RLS-less
// table. See ADR-0002.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table businesses enable row level security`.execute(db);
  await sql`alter table staff enable row level security`.execute(db);
  await sql`alter table customers enable row level security`.execute(db);
  await sql`alter table pending_checkins enable row level security`.execute(db);
  await sql`alter table visits enable row level security`.execute(db);
  await sql`alter table redemptions enable row level security`.execute(db);
  await sql`alter table kysely_migration enable row level security`.execute(db);
  await sql`alter table kysely_migration_lock enable row level security`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table businesses disable row level security`.execute(db);
  await sql`alter table staff disable row level security`.execute(db);
  await sql`alter table customers disable row level security`.execute(db);
  await sql`alter table pending_checkins disable row level security`.execute(db);
  await sql`alter table visits disable row level security`.execute(db);
  await sql`alter table redemptions disable row level security`.execute(db);
  await sql`alter table kysely_migration disable row level security`.execute(db);
  await sql`alter table kysely_migration_lock disable row level security`.execute(db);
}
