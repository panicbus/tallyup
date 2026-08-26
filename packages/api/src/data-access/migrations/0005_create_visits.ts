import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table visits (
      id uuid primary key default gen_random_uuid(),
      business_id uuid not null references businesses (id),
      customer_id uuid not null,
      confirmed_by uuid not null,
      created_at timestamptz not null default now(),
      foreign key (customer_id, business_id) references customers (id, business_id),
      foreign key (confirmed_by, business_id) references staff (id, business_id)
    )
  `.execute(db);

  await sql`create index visits_business_customer_idx on visits (business_id, customer_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table visits`.execute(db);
}
