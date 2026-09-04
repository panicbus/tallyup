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
const TABLES = [
  'businesses',
  'staff',
  'customers',
  'pending_checkins',
  'visits',
  'redemptions',
  'kysely_migration',
  'kysely_migration_lock',
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const table of TABLES) {
    await sql`alter table ${sql.raw(table)} enable row level security`.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of TABLES) {
    await sql`alter table ${sql.raw(table)} disable row level security`.execute(db);
  }
}
