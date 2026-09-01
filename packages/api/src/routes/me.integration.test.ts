import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from '../data-access/staff-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import type { Database } from '../data-access/types.js';

async function seedBusinessWithStaff(db: Kysely<Database>, authUserId: string, logoUrl: string | null = null) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Me Route Shop',
      slug: `me-route-${randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free item',
      logo_url: logoUrl,
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

describe('GET /me', () => {
  test('returns the signed-in staff member and their business', async ({ realDb }) => {
    const authUserId = randomUUID();
    const { business, staff } = await seedBusinessWithStaff(realDb, authUserId);
    const { port: authPort, issueToken } = createInMemoryAuthPort();
    const token = issueToken({ userId: authUserId, email: 'owner@example.com' });
    const app = buildApp(
      { checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb },
      { logger: false },
    );

    const response = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
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

  test('carries the business logo URL through to the dashboard', async ({ realDb }) => {
    const authUserId = randomUUID();
    const logoUrl = 'https://test-project.supabase.co/storage/v1/object/public/business-logos/u/logo.png';
    await seedBusinessWithStaff(realDb, authUserId, logoUrl);
    const { port: authPort, issueToken } = createInMemoryAuthPort();
    const token = issueToken({ userId: authUserId, email: 'owner@example.com' });
    const app = buildApp(
      { checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb },
      { logger: false },
    );

    const response = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });

    expect(response.json().business).toMatchObject({ logoUrl });
  });

  test('401s with no Authorization header', async ({ realDb }) => {
    const { port: authPort } = createInMemoryAuthPort();
    const app = buildApp({ checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb }, { logger: false });

    const response = await app.inject({ method: 'GET', url: '/me' });

    expect(response.statusCode).toBe(401);
  });

  test('401s for a token the auth provider does not recognize', async ({ realDb }) => {
    const { port: authPort } = createInMemoryAuthPort();
    const app = buildApp({ checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb }, { logger: false });

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer not-a-real-token' },
    });

    expect(response.statusCode).toBe(401);
  });

  test('401s for a verified identity with no linked staff row', async ({ realDb }) => {
    const { port: authPort, issueToken } = createInMemoryAuthPort();
    const token = issueToken({ userId: randomUUID(), email: 'nobody@example.com' });
    const app = buildApp({ checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb }, { logger: false });

    const response = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });

    expect(response.statusCode).toBe(401);
  });
});
