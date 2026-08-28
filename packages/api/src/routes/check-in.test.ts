import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CheckInPort } from '../data-access/check-in-port.js';
import { buildApp } from '../app.js';
import { createDb } from '../data-access/db.js';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import { createInMemoryStaffPort } from '../test-support/in-memory-staff-port.js';

function buildTestApp(checkInPort: CheckInPort) {
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const { port: staffPort, addStaff } = createInMemoryStaffPort();
  // Never queried by these tests — Pool connections are lazy, so a bogus
  // connection string is fine for a dependency none of them exercise.
  const app = buildApp({ checkInPort, authPort, staffPort, db: createDb('postgres://unused') }, { logger: false });

  function loginAsStaffOf(businessId: string) {
    const authUserId = randomUUID();
    const staff = addStaff({ authUserId, businessId });
    const token = issueToken({ userId: authUserId, email: staff.email });
    return { staffId: staff.id, headers: { authorization: `Bearer ${token}` } };
  }

  return { app, loginAsStaffOf };
}

describe('POST /businesses/:slug/pending-checkins', () => {
  it('creates a pending check-in for a known business', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { app } = buildTestApp(port);

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/pending-checkins',
      payload: { phone: '555-123-4567' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('id');
    expect(response.json()).toHaveProperty('expiresAt');
  });

  it('rejects an invalid phone number', async () => {
    const { port } = createInMemoryCheckInPort();
    const { app } = buildTestApp(port);

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/pending-checkins',
      payload: { phone: 'not a phone' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('404s for an unknown business slug', async () => {
    const { port } = createInMemoryCheckInPort();
    const { app } = buildTestApp(port);

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/no-such-shop/pending-checkins',
      payload: { phone: '555-123-4567' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /pending-checkins/:id/confirm', () => {
  it('confirms a pending check-in for a signed-in staff member of that business', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(business.id);
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const response = await app.inject({ method: 'POST', url: `/pending-checkins/${pending.id}/confirm`, headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ outcome: 'confirmed', customer: { points: 1 } });
  });

  it('401s with no Authorization header', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { app } = buildTestApp(port);
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const response = await app.inject({ method: 'POST', url: `/pending-checkins/${pending.id}/confirm` });

    expect(response.statusCode).toBe(401);
  });

  it("403s confirming a pending check-in belonging to another business", async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const otherBusiness = await seedBusiness({ slug: 'other-shop', rewardThreshold: 10 });
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(otherBusiness.id);
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const response = await app.inject({ method: 'POST', url: `/pending-checkins/${pending.id}/confirm`, headers });

    expect(response.statusCode).toBe(403);
  });

  it('404s confirming an unknown pending check-in', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(business.id);

    const response = await app.inject({ method: 'POST', url: `/pending-checkins/${randomUUID()}/confirm`, headers });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /customers/:id/redeem', () => {
  async function confirmedCustomer(port: CheckInPort, businessId: string, phone: string) {
    const pending = await port.createPendingCheckin({ businessId, phone });
    const result = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: randomUUID() });
    if (result.outcome !== 'confirmed') throw new Error('setup failed');
    return result.customer;
  }

  it('redeems for an eligible customer', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 1 });
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(business.id);
    const customer = await confirmedCustomer(port, business.id, '+15551234567');

    const response = await app.inject({ method: 'POST', url: `/customers/${customer.id}/redeem`, headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ outcome: 'redeemed', customer: { points: 0 } });
  });

  it('409s when not eligible', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(business.id);
    const customer = await confirmedCustomer(port, business.id, '+15551234567');

    const response = await app.inject({ method: 'POST', url: `/customers/${customer.id}/redeem`, headers });

    expect(response.statusCode).toBe(409);
  });

  it('401s with no Authorization header', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 1 });
    const { app } = buildTestApp(port);
    const customer = await confirmedCustomer(port, business.id, '+15551234567');

    const response = await app.inject({ method: 'POST', url: `/customers/${customer.id}/redeem` });

    expect(response.statusCode).toBe(401);
  });

  it('403s redeeming for a customer belonging to another business', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 1 });
    const otherBusiness = await seedBusiness({ slug: 'other-shop', rewardThreshold: 1 });
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(otherBusiness.id);
    const customer = await confirmedCustomer(port, business.id, '+15551234567');

    const response = await app.inject({ method: 'POST', url: `/customers/${customer.id}/redeem`, headers });

    expect(response.statusCode).toBe(403);
  });
});

describe('GET /businesses/:slug/pending-checkins', () => {
  it('lists the masked queue for the signed-in staff member\'s own business', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(business.id);

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/pending-checkins', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([{ maskedPhone: '•••-•••-4567' }]);
  });

  it('401s with no Authorization header', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { app } = buildTestApp(port);

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/pending-checkins' });

    expect(response.statusCode).toBe(401);
  });

  it("403s for staff signed in to a different business than the slug", async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const otherBusiness = await seedBusiness({ slug: 'other-shop', rewardThreshold: 10 });
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(otherBusiness.id);

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/pending-checkins', headers });

    expect(response.statusCode).toBe(403);
  });

  it('404s for an unknown business slug', async () => {
    const { port } = createInMemoryCheckInPort();
    const { app, loginAsStaffOf } = buildTestApp(port);
    const { headers } = loginAsStaffOf(randomUUID());

    const response = await app.inject({ method: 'GET', url: '/businesses/no-such-shop/pending-checkins', headers });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /businesses/:slug', () => {
  it('returns public business info', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10, name: 'Test Shop', rewardDescription: 'Free book' });
    const { app } = buildTestApp(port);

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Test Shop',
      rewardThreshold: 10,
      rewardDescription: 'Free book',
    });
  });

  it('404s for an unknown business slug', async () => {
    const { port } = createInMemoryCheckInPort();
    const { app } = buildTestApp(port);

    const response = await app.inject({ method: 'GET', url: '/businesses/no-such-shop' });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /pending-checkins/:id/status', () => {
  it('reports pending before confirmation', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    const { app } = buildTestApp(port);

    const response = await app.inject({ method: 'GET', url: `/pending-checkins/${pending.id}/status` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'pending' });
  });

  it('reports confirmed with the resulting points, after confirmation', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: randomUUID() });
    const { app } = buildTestApp(port);

    const response = await app.inject({ method: 'GET', url: `/pending-checkins/${pending.id}/status` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'confirmed', customer: { points: 1 } });
  });

  it('404s for an unknown pending check-in id', async () => {
    const { port } = createInMemoryCheckInPort();
    const { app } = buildTestApp(port);

    const response = await app.inject({ method: 'GET', url: `/pending-checkins/${randomUUID()}/status` });

    expect(response.statusCode).toBe(404);
  });
});
