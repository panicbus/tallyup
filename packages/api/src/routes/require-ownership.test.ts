import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { createDb } from '../data-access/db.js';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import { createInMemoryStaffPort } from '../test-support/in-memory-staff-port.js';
import { requireStaff } from './require-staff.js';
import {
  ownerByCustomerParam,
  ownerByPendingCheckinParam,
  ownerBySlugParam,
  requireOwnership,
  type OwnerResolver,
} from './require-ownership.js';
import type { AppDependencies } from '../app.js';

/**
 * Exercises the guard in isolation, against a probe route rather than a real
 * one — the four real call sites keep their own tests, which prove the wiring.
 */
function buildProbe(
  resolveOwner: OwnerResolver,
  options?: { missing?: 'notFound' | 'allow' },
  url = '/probe/:slug',
) {
  const { port: checkInPort, seedBusiness } = createInMemoryCheckInPort();
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const { port: staffPort, addStaff } = createInMemoryStaffPort();
  // Never queried — Pool connections are lazy, so a bogus connection string is
  // fine for a dependency the guard never touches.
  const deps: AppDependencies = { checkInPort, authPort, staffPort, db: createDb('postgres://unused') };

  const app: FastifyInstance = Fastify({ logger: false });
  app.get(url, { preHandler: [requireStaff(deps), requireOwnership(deps, resolveOwner, options)] }, async () => ({
    reached: true,
  }));

  function loginAsStaffOf(businessId: string) {
    const authUserId = randomUUID();
    const staff = addStaff({ authUserId, businessId });
    return { authorization: `Bearer ${issueToken({ userId: authUserId, email: staff.email })}` };
  }

  return { app, checkInPort, seedBusiness, loginAsStaffOf };
}

describe('requireOwnership', () => {
  it("reaches the handler when the resource belongs to the caller's own business", async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildProbe(ownerBySlugParam);
    const business = await seedBusiness({ slug: 'own-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/probe/own-shop',
      headers: loginAsStaffOf(business.id),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reached: true });
  });

  it('403s when the resource belongs to a different business', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildProbe(ownerBySlugParam);
    await seedBusiness({ slug: 'their-shop', rewardThreshold: 10 });
    const otherBusiness = await seedBusiness({ slug: 'my-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/probe/their-shop',
      headers: loginAsStaffOf(otherBusiness.id),
    });

    expect(response.statusCode).toBe(403);
  });

  it('404s when the resource does not exist, under the default policy', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildProbe(ownerBySlugParam);
    const business = await seedBusiness({ slug: 'own-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/probe/no-such-shop',
      headers: loginAsStaffOf(business.id),
    });

    expect(response.statusCode).toBe(404);
  });

  it("reaches the handler for a missing resource under missing: 'allow'", async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildProbe(ownerBySlugParam, { missing: 'allow' });
    const business = await seedBusiness({ slug: 'own-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/probe/no-such-shop',
      headers: loginAsStaffOf(business.id),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reached: true });
  });

  it('401s before the guard runs, when the caller is not signed in at all', async () => {
    // Ordering constraint: requireStaff owns 401 and must short-circuit first,
    // or this guard would dereference an unset request.staff.
    const { app, seedBusiness } = buildProbe(ownerBySlugParam);
    await seedBusiness({ slug: 'own-shop', rewardThreshold: 10 });

    const response = await app.inject({ method: 'GET', url: '/probe/own-shop' });

    expect(response.statusCode).toBe(401);
  });
});

describe('owner resolvers', () => {
  it('ownerBySlugParam resolves the business named by :slug', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildProbe(ownerBySlugParam);
    const business = await seedBusiness({ slug: 'own-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/probe/own-shop',
      headers: loginAsStaffOf(business.id),
    });

    expect(response.statusCode).toBe(200);
  });

  it('ownerByPendingCheckinParam resolves the business owning the pending check-in named by :id', async () => {
    const { app, checkInPort, seedBusiness, loginAsStaffOf } = buildProbe(
      ownerByPendingCheckinParam,
      undefined,
      '/probe/:id',
    );
    const business = await seedBusiness({ slug: 'own-shop', rewardThreshold: 10 });
    const pending = await checkInPort.createPendingCheckin({ businessId: business.id, phone: '+15551230001' });

    const mine = await app.inject({
      method: 'GET',
      url: `/probe/${pending.id}`,
      headers: loginAsStaffOf(business.id),
    });
    const theirs = await app.inject({
      method: 'GET',
      url: `/probe/${pending.id}`,
      headers: loginAsStaffOf(randomUUID()),
    });

    expect(mine.statusCode).toBe(200);
    expect(theirs.statusCode).toBe(403);
  });

  it('ownerByCustomerParam resolves the business owning the customer named by :id', async () => {
    const { app, checkInPort, seedBusiness, loginAsStaffOf } = buildProbe(
      ownerByCustomerParam,
      undefined,
      '/probe/:id',
    );
    const business = await seedBusiness({ slug: 'own-shop', rewardThreshold: 10 });
    const pending = await checkInPort.createPendingCheckin({ businessId: business.id, phone: '+15551230002' });
    const confirmed = await checkInPort.confirmCheckin({
      pendingCheckinId: pending.id,
      confirmedBy: business.confirmedBy,
    });
    if (confirmed.outcome !== 'confirmed') throw new Error('setup failed');

    const mine = await app.inject({
      method: 'GET',
      url: `/probe/${confirmed.customer.id}`,
      headers: loginAsStaffOf(business.id),
    });
    const theirs = await app.inject({
      method: 'GET',
      url: `/probe/${confirmed.customer.id}`,
      headers: loginAsStaffOf(randomUUID()),
    });

    expect(mine.statusCode).toBe(200);
    expect(theirs.statusCode).toBe(403);
  });
});
