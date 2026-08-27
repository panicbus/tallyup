import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { createKyselyCheckInPort } from './kysely-check-in-port.js';
import type { CheckInPort } from './check-in-port.js';
import type { Database } from './types.js';

async function seedBusinessAndStaff(db: Kysely<Database>, rewardThreshold: number) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Reconstruction Test Shop',
      slug: `reconstruction-${crypto.randomUUID()}`,
      reward_threshold: rewardThreshold,
      reward_description: 'Free item',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const staff = await db
    .insertInto('staff')
    .values({ business_id: business.id, email: `staff-${crypto.randomUUID()}@example.com`, role: 'owner' })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { business, staff };
}

async function checkInNTimes(
  port: CheckInPort,
  businessId: string,
  phone: string,
  confirmedBy: string,
  n: number,
): Promise<string> {
  let customerId = '';
  for (let i = 0; i < n; i++) {
    const pending = await port.createPendingCheckin({ businessId, phone });
    const result = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy });
    if (result.outcome === 'confirmed') {
      customerId = result.customer.id;
    }
  }
  return customerId;
}

async function currentPoints(db: Kysely<Database>, customerId: string): Promise<number> {
  const row = await db
    .selectFrom('customers')
    .select('points')
    .where('id', '=', customerId)
    .executeTakeFirstOrThrow();
  return row.points;
}

async function reconstructedPoints(db: Kysely<Database>, businessId: string, customerId: string): Promise<number> {
  const visits = await db
    .selectFrom('visits')
    .select(({ fn }) => fn.countAll().as('count'))
    .where('business_id', '=', businessId)
    .where('customer_id', '=', customerId)
    .executeTakeFirstOrThrow();

  const redemptions = await db
    .selectFrom('redemptions')
    .select(() => sql<string>`coalesce(sum(threshold_applied), 0)`.as('total'))
    .where('business_id', '=', businessId)
    .where('customer_id', '=', customerId)
    .executeTakeFirstOrThrow();

  return Number(visits.count) - Number(redemptions.total);
}

describe('points reconstruction invariant', () => {
  test('holds with zero redemptions', async ({ realDb }) => {
    const { business, staff } = await seedBusinessAndStaff(realDb, 10);
    const port = createKyselyCheckInPort(realDb);
    const customerId = await checkInNTimes(port, business.id, '+15559990001', staff.id, 3);

    const actual = await currentPoints(realDb, customerId);
    expect(actual).toBe(3);
    expect(await reconstructedPoints(realDb, business.id, customerId)).toBe(actual);
  });

  test('holds with one redemption', async ({ realDb }) => {
    const { business, staff } = await seedBusinessAndStaff(realDb, 10);
    const port = createKyselyCheckInPort(realDb);
    const customerId = await checkInNTimes(port, business.id, '+15559990002', staff.id, 10);

    const redeemResult = await port.redeem({ customerId, confirmedBy: staff.id });
    expect(redeemResult.outcome).toBe('redeemed');

    const actual = await currentPoints(realDb, customerId);
    expect(actual).toBe(0);
    expect(await reconstructedPoints(realDb, business.id, customerId)).toBe(actual);
  });

  test('holds across multiple redemptions with a threshold change in between', async ({ realDb }) => {
    const { business, staff } = await seedBusinessAndStaff(realDb, 10);
    const port = createKyselyCheckInPort(realDb);
    const customerId = await checkInNTimes(port, business.id, '+15559990003', staff.id, 12);

    const firstRedeem = await port.redeem({ customerId, confirmedBy: staff.id });
    expect(firstRedeem).toMatchObject({ outcome: 'redeemed', customer: { points: 2 } });

    // Simulate a future admin edit (W8) changing the threshold mid-history.
    // threshold_applied must snapshot whatever was current at each
    // redemption, not be reconstructed from today's value.
    await realDb.updateTable('businesses').set({ reward_threshold: 5 }).where('id', '=', business.id).execute();

    await checkInNTimes(port, business.id, '+15559990003', staff.id, 4); // now at 2 + 4 = 6

    const secondRedeem = await port.redeem({ customerId, confirmedBy: staff.id });
    expect(secondRedeem).toMatchObject({ outcome: 'redeemed', customer: { points: 1 } });

    const actual = await currentPoints(realDb, customerId);
    expect(actual).toBe(1);
    expect(await reconstructedPoints(realDb, business.id, customerId)).toBe(actual);

    const appliedThresholds = await realDb
      .selectFrom('redemptions')
      .select('threshold_applied')
      .where('business_id', '=', business.id)
      .where('customer_id', '=', customerId)
      .orderBy('created_at', 'asc')
      .execute();
    expect(appliedThresholds.map((r) => r.threshold_applied)).toEqual([10, 5]);
  });
});
