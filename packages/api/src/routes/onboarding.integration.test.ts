import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from '../data-access/staff-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import type { Database } from '../data-access/types.js';

function buildOnboardingApp(realDb: Kysely<Database>) {
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const app = buildApp(
    { checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb },
    { logger: false },
  );
  return { app, issueToken };
}

describe('POST /businesses', () => {
  test('creates a business and signs the caller in as its owner', async ({ realDb }) => {
    const { app, issueToken } = buildOnboardingApp(realDb);
    const authUserId = randomUUID();
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'owner@example.com' })}` };
    const slug = `new-shop-${randomUUID()}`;

    const response = await app.inject({
      method: 'POST',
      url: '/businesses',
      headers,
      payload: { name: 'New Shop', slug, rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      outcome: 'created',
      business: { name: 'New Shop', slug, rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    const meResponse = await app.inject({ method: 'GET', url: '/me', headers });
    expect(meResponse.json()).toMatchObject({ email: 'owner@example.com', role: 'owner', business: { slug } });
  });

  test('401s with no Authorization header', async ({ realDb }) => {
    const { app } = buildOnboardingApp(realDb);

    const response = await app.inject({
      method: 'POST',
      url: '/businesses',
      payload: { name: 'New Shop', slug: `new-shop-${randomUUID()}`, rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    expect(response.statusCode).toBe(401);
  });

  test('400s for an invalid slug', async ({ realDb }) => {
    const { app, issueToken } = buildOnboardingApp(realDb);
    const headers = { authorization: `Bearer ${issueToken()}` };

    const response = await app.inject({
      method: 'POST',
      url: '/businesses',
      headers,
      payload: { name: 'New Shop', slug: 'Not A Slug!', rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    expect(response.statusCode).toBe(400);
  });

  test('409s when the slug is already taken', async ({ realDb }) => {
    const { app, issueToken } = buildOnboardingApp(realDb);
    const slug = `dup-shop-${randomUUID()}`;
    await app.inject({
      method: 'POST',
      url: '/businesses',
      headers: { authorization: `Bearer ${issueToken()}` },
      payload: { name: 'First Shop', slug, rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses',
      headers: { authorization: `Bearer ${issueToken()}` },
      payload: { name: 'Second Shop', slug, rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'slug_taken' });
  });

  test('409s when the caller has already onboarded a business', async ({ realDb }) => {
    const { app, issueToken } = buildOnboardingApp(realDb);
    const authUserId = randomUUID();
    const headers = { authorization: `Bearer ${issueToken({ userId: authUserId, email: 'owner@example.com' })}` };
    await app.inject({
      method: 'POST',
      url: '/businesses',
      headers,
      payload: { name: 'First Shop', slug: `first-${randomUUID()}`, rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses',
      headers,
      payload: { name: 'Second Shop', slug: `second-${randomUUID()}`, rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'already_onboarded' });
  });
});
