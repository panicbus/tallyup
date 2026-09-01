import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { findStaffByAuthUserId } from './staff.js';
import type { Database } from './types.js';

async function seedBusinessWithStaff(db: Kysely<Database>, authUserId: string | null) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Staff Lookup Shop',
      slug: `staff-lookup-${randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free item',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const staff = await db
    .insertInto('staff')
    .values({ business_id: business.id, email: 'owner@example.com', role: 'owner', auth_user_id: authUserId })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { business, staff };
}

describe('findStaffByAuthUserId', () => {
  test('resolves the staff member and their business for a linked auth account', async ({ db }) => {
    const authUserId = randomUUID();
    const { business, staff } = await seedBusinessWithStaff(db, authUserId);

    const result = await findStaffByAuthUserId(db, authUserId);

    expect(result).toEqual({
      id: staff.id,
      email: 'owner@example.com',
      role: 'owner',
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        rewardThreshold: business.reward_threshold,
        rewardDescription: business.reward_description,
        logoUrl: null,
      },
    });
  });

  test('returns null for an auth account with no linked staff row', async ({ db }) => {
    const result = await findStaffByAuthUserId(db, randomUUID());
    expect(result).toBeNull();
  });

  test('returns null for a staff row that has never been linked to an auth account', async ({ db }) => {
    await seedBusinessWithStaff(db, null);

    // A null auth_user_id must never match another null lookup — there is
    // no real token whose verified identity is "no id", so this path
    // should be unreachable, but the query must not treat null = null.
    const result = await findStaffByAuthUserId(db, null as unknown as string);

    expect(result).toBeNull();
  });
});
