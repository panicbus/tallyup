import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from '../data-access/kysely-staff-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import type { Database } from '../data-access/types.js';

async function seedBusinessAndStaff(realDb: Kysely<Database>) {
  const business = await realDb
    .insertInto('businesses')
    .values({
      name: 'E2E Shop',
      slug: `e2e-shop-${crypto.randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free item',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const authUserId = randomUUID();
  await realDb
    .insertInto('staff')
    .values({
      business_id: business.id,
      email: `e2e-staff-${crypto.randomUUID()}@example.com`,
      role: 'owner',
      auth_user_id: authUserId,
    })
    .execute();

  return { business, authUserId };
}

function buildAuthedApp(realDb: Kysely<Database>) {
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const app = buildApp(
    { checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb },
    { logger: false },
  );
  return { app, issueToken };
}

describe('GET /businesses/:slug/customers, end to end via HTTP', () => {
  test('returns real customers with masked phones, never the raw number', async ({ realDb }) => {
    const { business, authUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'e2e@example.com' })}` };

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/pending-checkins`,
      payload: { phone: '555-999-0011' },
    });
    const { id: pendingCheckinId } = createResponse.json();
    await app.inject({ method: 'POST', url: `/pending-checkins/${pendingCheckinId}/confirm`, headers });

    const response = await app.inject({ method: 'GET', url: `/businesses/${business.slug}/customers`, headers });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ maskedPhone: '•••-•••-0011', points: 1, hasSmsConsent: false });
    expect(JSON.stringify(body)).not.toContain('5559990011');
  });

  test('reflects sms consent for a customer who opted in', async ({ realDb }) => {
    const { business, authUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'e2e@example.com' })}` };

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/pending-checkins`,
      payload: { phone: '555-999-0012', smsConsent: true },
    });
    const { id: pendingCheckinId } = createResponse.json();
    await app.inject({ method: 'POST', url: `/pending-checkins/${pendingCheckinId}/confirm`, headers });

    const response = await app.inject({ method: 'GET', url: `/businesses/${business.slug}/customers`, headers });

    expect(response.json().items[0]).toMatchObject({ hasSmsConsent: true });
  });

  test('a staff member cannot read another business\'s roster', async ({ realDb }) => {
    const { business: businessA } = await seedBusinessAndStaff(realDb);
    const { authUserId: authUserIdB } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headersB = { authorization: `Bearer ${issueToken({ userId: authUserIdB, email: 'staff-b@example.com' })}` };

    const response = await app.inject({
      method: 'GET',
      url: `/businesses/${businessA.slug}/customers`,
      headers: headersB,
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('GET /businesses/:slug/customers/export, end to end via HTTP', () => {
  test('exports real customers as CSV with masked phones, never the raw number', async ({ realDb }) => {
    const { business, authUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildAuthedApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'e2e@example.com' })}` };

    const createResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/pending-checkins`,
      payload: { phone: '555-999-0013', smsConsent: true },
    });
    const { id: pendingCheckinId } = createResponse.json();
    await app.inject({ method: 'POST', url: `/pending-checkins/${pendingCheckinId}/confirm`, headers });

    const response = await app.inject({
      method: 'GET',
      url: `/businesses/${business.slug}/customers/export`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);
    const lines = response.body.split('\r\n');
    expect(lines[0]).toBe('Phone,Points,Joined,SMS Consent');
    const [phone, points, joined, consent] = lines[1]!.split(',');
    expect(phone).toBe('•••-•••-0013');
    expect(points).toBe('1');
    expect(new Date(joined!).getTime()).not.toBeNaN();
    expect(consent).toBe('yes');
    expect(response.body).not.toContain('5559990013');
  });
});
