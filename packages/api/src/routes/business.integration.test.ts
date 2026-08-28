import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from '../data-access/staff-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import type { Database } from '../data-access/types.js';

async function seedBusinessAndStaff(db: Kysely<Database>) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Settings Shop',
      slug: `settings-shop-${randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free item',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const authUserId = randomUUID();
  await db
    .insertInto('staff')
    .values({ business_id: business.id, email: 'owner@example.com', role: 'owner', auth_user_id: authUserId })
    .execute();

  return { business, authUserId };
}

function buildBusinessApp(realDb: Kysely<Database>) {
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const app = buildApp(
    { checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb },
    { logger: false },
  );
  return { app, issueToken };
}

describe('PATCH /businesses/:slug', () => {
  test('updates name, threshold, and reward description', async ({ realDb }) => {
    const { business, authUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildBusinessApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'owner@example.com' })}` };

    const response = await app.inject({
      method: 'PATCH',
      url: `/businesses/${business.slug}`,
      headers,
      payload: { name: 'New Name', rewardThreshold: 5, rewardDescription: 'New reward' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'New Name',
      slug: business.slug,
      rewardThreshold: 5,
      rewardDescription: 'New reward',
    });
  });

  test('401s with no Authorization header', async ({ realDb }) => {
    const { business } = await seedBusinessAndStaff(realDb);
    const { app } = buildBusinessApp(realDb);

    const response = await app.inject({
      method: 'PATCH',
      url: `/businesses/${business.slug}`,
      payload: { name: 'New Name', rewardThreshold: 5, rewardDescription: 'New reward' },
    });

    expect(response.statusCode).toBe(401);
  });

  test('403s for staff signed in to a different business', async ({ realDb }) => {
    const { business } = await seedBusinessAndStaff(realDb);
    const { authUserId: otherAuthUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildBusinessApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: otherAuthUserId, email: 'other@example.com' })}` };

    const response = await app.inject({
      method: 'PATCH',
      url: `/businesses/${business.slug}`,
      headers,
      payload: { name: 'New Name', rewardThreshold: 5, rewardDescription: 'New reward' },
    });

    expect(response.statusCode).toBe(403);
  });

  test('404s for an unknown slug', async ({ realDb }) => {
    const { authUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildBusinessApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'owner@example.com' })}` };

    const response = await app.inject({
      method: 'PATCH',
      url: '/businesses/no-such-shop',
      headers,
      payload: { name: 'New Name', rewardThreshold: 5, rewardDescription: 'New reward' },
    });

    expect(response.statusCode).toBe(404);
  });

  test('ignores a slug field in the body — slug is not editable here', async ({ realDb }) => {
    const { business, authUserId } = await seedBusinessAndStaff(realDb);
    const { app, issueToken } = buildBusinessApp(realDb);
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'owner@example.com' })}` };

    const response = await app.inject({
      method: 'PATCH',
      url: `/businesses/${business.slug}`,
      headers,
      payload: { name: 'New Name', slug: 'hijacked-slug', rewardThreshold: 5, rewardDescription: 'New reward' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ slug: business.slug });
  });
});
