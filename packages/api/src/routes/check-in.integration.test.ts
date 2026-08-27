import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import type { Database } from '../data-access/types.js';

async function seedBusinessAndStaff(db: Kysely<Database>, rewardThreshold = 10) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'E2E Shop',
      slug: `e2e-shop-${crypto.randomUUID()}`,
      reward_threshold: rewardThreshold,
      reward_description: 'Free item',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const staff = await db
    .insertInto('staff')
    .values({ business_id: business.id, email: `e2e-staff-${crypto.randomUUID()}@example.com`, role: 'owner' })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { business, staff };
}

describe('check-in fraud gate, end to end via HTTP', () => {
  test('a pending check-in can only ever be confirmed once', async ({ realDb }) => {
    const { business, staff } = await seedBusinessAndStaff(realDb);
    const app = buildApp({ checkInPort: createKyselyCheckInPort(realDb), db: realDb }, { logger: false });

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/pending-checkins`,
      payload: { phone: '555-999-0001' },
    });
    expect(createResponse.statusCode).toBe(200);
    const { id: pendingCheckinId } = createResponse.json();

    const firstConfirm = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pendingCheckinId}/confirm`,
      payload: { confirmedBy: staff.id },
    });
    expect(firstConfirm.statusCode).toBe(200);
    expect(firstConfirm.json()).toMatchObject({ outcome: 'confirmed', customer: { points: 1 } });

    const secondConfirm = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pendingCheckinId}/confirm`,
      payload: { confirmedBy: staff.id },
    });
    expect(secondConfirm.statusCode).toBe(404);
  });

  test('a redemption can only ever be spent once', async ({ realDb }) => {
    const { business, staff } = await seedBusinessAndStaff(realDb, 1);
    const app = buildApp({ checkInPort: createKyselyCheckInPort(realDb), db: realDb }, { logger: false });

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/pending-checkins`,
      payload: { phone: '555-999-0002' },
    });
    const { id: pendingCheckinId } = createResponse.json();

    const confirmResponse = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pendingCheckinId}/confirm`,
      payload: { confirmedBy: staff.id },
    });
    const { customer } = confirmResponse.json();

    const firstRedeem = await app.inject({
      method: 'POST',
      url: `/customers/${customer.id}/redeem`,
      payload: { confirmedBy: staff.id },
    });
    expect(firstRedeem.statusCode).toBe(200);
    expect(firstRedeem.json()).toMatchObject({ outcome: 'redeemed' });

    const secondRedeem = await app.inject({
      method: 'POST',
      url: `/customers/${customer.id}/redeem`,
      payload: { confirmedBy: staff.id },
    });
    expect(secondRedeem.statusCode).toBe(409);
  });
});
