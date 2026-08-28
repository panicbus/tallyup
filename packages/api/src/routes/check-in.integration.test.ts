import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from '../data-access/staff-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
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

  const authUserId = randomUUID();
  const staff = await db
    .insertInto('staff')
    .values({
      business_id: business.id,
      email: `e2e-staff-${crypto.randomUUID()}@example.com`,
      role: 'owner',
      auth_user_id: authUserId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { business, staff, authUserId };
}

function buildAuthedApp(realDb: Kysely<Database>) {
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const app = buildApp(
    { checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort },
    { logger: false },
  );
  return { app, issueToken };
}

describe('check-in fraud gate, end to end via HTTP', () => {
  test('a pending check-in can only ever be confirmed once', async ({ realDb }) => {
    const { business, authUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'e2e@example.com' })}` };

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
      headers,
    });
    expect(firstConfirm.statusCode).toBe(200);
    expect(firstConfirm.json()).toMatchObject({ outcome: 'confirmed', customer: { points: 1 } });

    const secondConfirm = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pendingCheckinId}/confirm`,
      headers,
    });
    expect(secondConfirm.statusCode).toBe(404);
  });

  test('a redemption can only ever be spent once', async ({ realDb }) => {
    const { business, authUserId } = await seedBusinessAndStaff(realDb, 1);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'e2e@example.com' })}` };

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/pending-checkins`,
      payload: { phone: '555-999-0002' },
    });
    const { id: pendingCheckinId } = createResponse.json();

    const confirmResponse = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pendingCheckinId}/confirm`,
      headers,
    });
    const { customer } = confirmResponse.json();

    const firstRedeem = await app.inject({ method: 'POST', url: `/customers/${customer.id}/redeem`, headers });
    expect(firstRedeem.statusCode).toBe(200);
    expect(firstRedeem.json()).toMatchObject({ outcome: 'redeemed' });

    const secondRedeem = await app.inject({ method: 'POST', url: `/customers/${customer.id}/redeem`, headers });
    expect(secondRedeem.statusCode).toBe(409);
  });

  test('the customer status poll transitions from pending to confirmed', async ({ realDb }) => {
    const { business, authUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'e2e@example.com' })}` };

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/pending-checkins`,
      payload: { phone: '555-999-0003' },
    });
    const { id: pendingCheckinId } = createResponse.json();

    const pendingStatus = await app.inject({ method: 'GET', url: `/pending-checkins/${pendingCheckinId}/status` });
    expect(pendingStatus.statusCode).toBe(200);
    expect(pendingStatus.json()).toMatchObject({ status: 'pending' });

    await app.inject({ method: 'POST', url: `/pending-checkins/${pendingCheckinId}/confirm`, headers });

    const confirmedStatus = await app.inject({ method: 'GET', url: `/pending-checkins/${pendingCheckinId}/status` });
    expect(confirmedStatus.statusCode).toBe(200);
    expect(confirmedStatus.json()).toMatchObject({ status: 'confirmed', customer: { points: 1 } });
  });

  test('check-in submission is rate-limited per IP', async ({ realDb }) => {
    const { business } = await seedBusinessAndStaff(realDb);
    const { app } = buildAuthedApp(realDb);

    const responses = [];
    for (let i = 0; i < 11; i++) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: `/businesses/${business.slug}/pending-checkins`,
          payload: { phone: '555-999-0004' },
        }),
      );
    }

    const statusCodes = responses.map((r) => r.statusCode);
    expect(statusCodes.filter((code) => code === 200).length).toBe(10);
    expect(statusCodes.filter((code) => code === 429).length).toBe(1);
  });

  test('a staff member cannot confirm a check-in belonging to another business', async ({ realDb }) => {
    const { business: businessA } = await seedBusinessAndStaff(realDb);
    const { authUserId: authUserIdB } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headersB = { authorization: `Bearer ${issueToken({ userId: authUserIdB, email: 'staff-b@example.com' })}` };

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${businessA.slug}/pending-checkins`,
      payload: { phone: '555-999-0005' },
    });
    const { id: pendingCheckinId } = createResponse.json();

    const confirmAsOtherBusiness = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pendingCheckinId}/confirm`,
      headers: headersB,
    });
    expect(confirmAsOtherBusiness.statusCode).toBe(403);

    const status = await app.inject({ method: 'GET', url: `/pending-checkins/${pendingCheckinId}/status` });
    expect(status.json()).toMatchObject({ status: 'pending' });
  });

  test('a staff member cannot read another business\'s queue or redeem its customers', async ({ realDb }) => {
    const { business: businessA, authUserId: authUserIdA } = await seedBusinessAndStaff(realDb, 1);
    const { authUserId: authUserIdB } = await seedBusinessAndStaff(realDb, 1);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headersA = { authorization: `Bearer ${issueToken({ userId: authUserIdA, email: 'staff-a@example.com' })}` };
    const headersB = { authorization: `Bearer ${issueToken({ userId: authUserIdB, email: 'staff-b@example.com' })}` };

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${businessA.slug}/pending-checkins`,
      payload: { phone: '555-999-0006' },
    });
    const { id: pendingCheckinId } = createResponse.json();
    const confirmResponse = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pendingCheckinId}/confirm`,
      headers: headersA,
    });
    const { customer } = confirmResponse.json();

    const queueAsOtherBusiness = await app.inject({
      method: 'GET',
      url: `/businesses/${businessA.slug}/pending-checkins`,
      headers: headersB,
    });
    expect(queueAsOtherBusiness.statusCode).toBe(403);

    const redeemAsOtherBusiness = await app.inject({
      method: 'POST',
      url: `/customers/${customer.id}/redeem`,
      headers: headersB,
    });
    expect(redeemAsOtherBusiness.statusCode).toBe(403);
  });
});
