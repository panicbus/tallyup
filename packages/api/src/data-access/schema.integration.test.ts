import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import type { Database } from './types.js';

async function insertBusiness(db: Kysely<Database>, overrides: Partial<{ slug: string }> = {}) {
  return db
    .insertInto('businesses')
    .values({
      name: 'Test Books',
      slug: overrides.slug ?? `test-books-${crypto.randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free book',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

async function insertStaff(db: Kysely<Database>, businessId: string) {
  return db
    .insertInto('staff')
    .values({ business_id: businessId, email: `staff-${crypto.randomUUID()}@example.com`, role: 'owner' })
    .returningAll()
    .executeTakeFirstOrThrow();
}

async function insertCustomer(
  db: Kysely<Database>,
  businessId: string,
  overrides: Partial<{ phone: string; points: number }> = {},
) {
  return db
    .insertInto('customers')
    .values({
      business_id: businessId,
      phone: overrides.phone ?? '+15555550100',
      points: overrides.points,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

async function twoBusinesses(db: Kysely<Database>) {
  const businessA = await insertBusiness(db, { slug: `a-${crypto.randomUUID()}` });
  const businessB = await insertBusiness(db, { slug: `b-${crypto.randomUUID()}` });
  return { businessA, businessB };
}

describe('migrations', () => {
  test('create all six expected tables', async ({ db }) => {
    const tables = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = 'public'
      and table_name not like 'kysely_migration%'
      order by table_name
    `.execute(db);

    expect(tables.rows.map((r) => r.table_name)).toEqual([
      'businesses',
      'customers',
      'pending_checkins',
      'redemptions',
      'staff',
      'visits',
    ]);
  });
});

describe('row level security', () => {
  test('every public table has RLS enabled', async ({ db }) => {
    const tables = await sql<{ relname: string; relrowsecurity: boolean }>`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `.execute(db);

    expect(tables.rows.length).toBeGreaterThan(0);
    for (const table of tables.rows) {
      expect(table.relrowsecurity, `${table.relname} should have RLS enabled`).toBe(true);
    }
  });
});

describe('businesses', () => {
  test('reward_threshold must be positive', async ({ db }) => {
    await expect(
      db
        .insertInto('businesses')
        .values({ name: 'Bad Shop', slug: `bad-shop-${crypto.randomUUID()}`, reward_threshold: 0, reward_description: 'x' })
        .execute(),
    ).rejects.toThrow(/violates check constraint/);
  });
});

describe('customers', () => {
  test('unique (business_id, phone) is enforced', async ({ db }) => {
    const business = await insertBusiness(db);
    await insertCustomer(db, business.id, { phone: '+15555550101' });

    await expect(insertCustomer(db, business.id, { phone: '+15555550101' })).rejects.toThrow(
      /duplicate key value violates unique constraint/,
    );
  });

  test('different businesses can share the same phone', async ({ db }) => {
    const { businessA, businessB } = await twoBusinesses(db);
    await insertCustomer(db, businessA.id, { phone: '+15555550102' });
    await expect(insertCustomer(db, businessB.id, { phone: '+15555550102' })).resolves.toBeDefined();
  });

  test('points cannot go negative', async ({ db }) => {
    const business = await insertBusiness(db);

    await expect(insertCustomer(db, business.id, { points: -1 })).rejects.toThrow(/violates check constraint/);
  });
});

describe('pending_checkins', () => {
  test('unique (business_id, phone) is enforced', async ({ db }) => {
    const business = await insertBusiness(db);
    const values = {
      business_id: business.id,
      phone: '+15555550103',
      expires_at: new Date(Date.now() + 20 * 60_000),
    };

    await db.insertInto('pending_checkins').values(values).execute();

    await expect(db.insertInto('pending_checkins').values(values).execute()).rejects.toThrow(
      /duplicate key value violates unique constraint/,
    );
  });
});

describe('business_id scoping (composite FKs)', () => {
  test('a visit cannot reference a customer from a different business', async ({ db }) => {
    const { businessA, businessB } = await twoBusinesses(db);
    const customerA = await insertCustomer(db, businessA.id, { phone: '+15555550104' });
    const staffB = await insertStaff(db, businessB.id);

    await expect(
      db
        .insertInto('visits')
        .values({ business_id: businessB.id, customer_id: customerA.id, confirmed_by: staffB.id })
        .execute(),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  test('a visit cannot reference staff from a different business', async ({ db }) => {
    const { businessA, businessB } = await twoBusinesses(db);
    const customerB = await insertCustomer(db, businessB.id, { phone: '+15555550105' });
    const staffA = await insertStaff(db, businessA.id);

    await expect(
      db
        .insertInto('visits')
        .values({ business_id: businessB.id, customer_id: customerB.id, confirmed_by: staffA.id })
        .execute(),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  test('a same-business visit succeeds', async ({ db }) => {
    const business = await insertBusiness(db);
    const staff = await insertStaff(db, business.id);
    const customer = await insertCustomer(db, business.id, { phone: '+15555550106' });

    await expect(
      db
        .insertInto('visits')
        .values({ business_id: business.id, customer_id: customer.id, confirmed_by: staff.id })
        .execute(),
    ).resolves.toBeDefined();
  });
});

describe('redemptions', () => {
  test('threshold_applied must be positive', async ({ db }) => {
    const business = await insertBusiness(db);
    const staff = await insertStaff(db, business.id);
    const customer = await insertCustomer(db, business.id, { phone: '+15555550107', points: 10 });

    await expect(
      db
        .insertInto('redemptions')
        .values({
          business_id: business.id,
          customer_id: customer.id,
          confirmed_by: staff.id,
          threshold_applied: 0,
        })
        .execute(),
    ).rejects.toThrow(/violates check constraint/);
  });
});
