import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../data-access/db.js';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import { createInMemoryStaffPort } from '../test-support/in-memory-staff-port.js';

/**
 * The branches of PATCH /businesses/:slug that never reach the database —
 * 401, 403, 404, 400. Only the 200 path needs real Postgres, and
 * business.integration.test.ts owns that. Before the tenant guard was its own
 * module these branches had no fake-testable seam, so this whole tier didn't
 * exist for this route.
 */
function buildTestApp() {
  const { port: checkInPort, seedBusiness } = createInMemoryCheckInPort();
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const { port: staffPort, addStaff } = createInMemoryStaffPort();
  // Never queried by these tests — every branch here replies before the
  // handler reaches updateBusiness.
  const app = buildApp({ checkInPort, authPort, staffPort, db: createDb('postgres://unused') }, { logger: false });

  function loginAsStaffOf(businessId: string) {
    const authUserId = randomUUID();
    const staff = addStaff({ authUserId, businessId });
    return { authorization: `Bearer ${issueToken({ userId: authUserId, email: staff.email })}` };
  }

  return { app, seedBusiness, loginAsStaffOf };
}

const validBody = { name: 'New Name', rewardThreshold: 5, rewardDescription: 'New reward' };

describe('PATCH /businesses/:slug', () => {
  it('401s with no Authorization header', async () => {
    const { app, seedBusiness } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({ method: 'PATCH', url: '/businesses/test-shop', payload: validBody });

    expect(response.statusCode).toBe(401);
  });

  it('403s for staff signed in to a different business', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const otherBusiness = await seedBusiness({ slug: 'other-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/businesses/test-shop',
      headers: loginAsStaffOf(otherBusiness.id),
      payload: validBody,
    });

    expect(response.statusCode).toBe(403);
  });

  it('404s for an unknown slug', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/businesses/no-such-shop',
      headers: loginAsStaffOf(business.id),
      payload: validBody,
    });

    expect(response.statusCode).toBe(404);
  });

  it('400s for an invalid body', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/businesses/test-shop',
      headers: loginAsStaffOf(business.id),
      payload: { name: '', rewardThreshold: 0, rewardDescription: '' },
    });

    expect(response.statusCode).toBe(400);
  });
});
