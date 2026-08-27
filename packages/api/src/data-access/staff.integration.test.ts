import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { listStaffByBusiness } from './staff.js';
import type { Database } from './types.js';

async function seedBusinessWithStaff(db: Kysely<Database>, emails: string[]) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Staff List Test Shop',
      slug: `staff-list-${crypto.randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free item',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  for (const email of emails) {
    await db.insertInto('staff').values({ business_id: business.id, email, role: 'owner' }).execute();
  }

  return business;
}

describe('listStaffByBusiness', () => {
  test('lists staff for the given business, alphabetically by email', async ({ db }) => {
    const business = await seedBusinessWithStaff(db, ['zed@example.com', 'anna@example.com']);

    const staff = await listStaffByBusiness(db, business.id);

    expect(staff.map((s) => s.email)).toEqual(['anna@example.com', 'zed@example.com']);
  });

  test('excludes staff from other businesses', async ({ db }) => {
    const businessA = await seedBusinessWithStaff(db, ['a@example.com']);
    await seedBusinessWithStaff(db, ['b@example.com']);

    const staff = await listStaffByBusiness(db, businessA.id);

    expect(staff.map((s) => s.email)).toEqual(['a@example.com']);
  });

  test('is empty for a business with no staff', async ({ db }) => {
    const business = await seedBusinessWithStaff(db, []);

    expect(await listStaffByBusiness(db, business.id)).toEqual([]);
  });
});
