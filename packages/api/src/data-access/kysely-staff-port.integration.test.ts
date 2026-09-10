import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { runStaffPortContractTests } from '../test-support/staff-port-contract.js';
import { createKyselyStaffPort } from './kysely-staff-port.js';
import type { Database, StaffRole } from './types.js';

async function seedBusiness(db: Kysely<Database>) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Staff Contract Test Shop',
      slug: `staff-contract-${crypto.randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free item',
    })
    .returning(['id', 'name', 'slug'])
    .executeTakeFirstOrThrow();
  return { id: business.id, name: business.name, slug: business.slug };
}

async function seedStaff(
  db: Kysely<Database>,
  input: { businessId: string; authUserId: string; role?: StaffRole },
) {
  const email = `staff-${crypto.randomUUID()}@example.com`;
  const staff = await db
    .insertInto('staff')
    .values({
      business_id: input.businessId,
      email,
      role: input.role ?? 'owner',
      auth_user_id: input.authUserId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id: staff.id, email };
}

runStaffPortContractTests(test, async ({ realDb }: { realDb: Kysely<Database> }) => ({
  port: createKyselyStaffPort(realDb),
  seedBusiness: () => seedBusiness(realDb),
  seedStaff: (input) => seedStaff(realDb, input),
}));

describe('deactivateStaff, real concurrency', () => {
  // The scenario the `for update` lock in kysely-staff-port.ts exists for —
  // not meaningfully testable against the single-threaded in-memory fake.
  // Two owners of the same 2-owner business each try to deactivate the
  // OTHER, at the same instant: exactly one may succeed, or the business
  // could be left with zero active owners.
  test('two concurrent attempts to deactivate different owners of a 2-owner business: exactly one succeeds', async ({
    realDb,
  }) => {
    const business = await seedBusiness(realDb);
    const ownerA = await seedStaff(realDb, { businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
    const ownerB = await seedStaff(realDb, { businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
    const port = createKyselyStaffPort(realDb);

    const [resultA, resultB] = await Promise.all([
      port.deactivateStaff({ staffId: ownerA.id, deactivatedBy: ownerB.id }),
      port.deactivateStaff({ staffId: ownerB.id, deactivatedBy: ownerA.id }),
    ]);

    expect([resultA.outcome, resultB.outcome].sort()).toEqual(['deactivated', 'last_owner']);
  });
});
