import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table sms_consents (
      id uuid primary key default gen_random_uuid(),
      business_id uuid not null references businesses (id),
      phone text not null,
      -- Append-only: a customer opting in twice (or re-checking in after an
      -- earlier unticked visit) writes a new row, never an update. This is
      -- the audit trail, so no row here is ever updated or deleted.
      consented_at timestamptz not null default now(),
      -- The exact rendered consent text, not just a version number, so this
      -- row stays truthful about what the customer actually saw even if the
      -- template is edited later.
      language text not null,
      ip text,
      user_agent text
    )
  `.execute(db);

  // Supports the "does this customer have any consent on file?" existence
  // check both this feature and the customer roster (W11) need.
  await sql`create index sms_consents_business_phone_idx on sms_consents (business_id, phone)`.execute(db);

  // See ADR-0002 / migration 0010: every public table needs RLS, or it's
  // reachable through Supabase's PostgREST API via the public anon key.
  await sql`alter table sms_consents enable row level security`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table sms_consents`.execute(db);
}
