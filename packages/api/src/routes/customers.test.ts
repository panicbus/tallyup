import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../data-access/db.js';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import { createInMemoryStaffPort } from '../test-support/in-memory-staff-port.js';
import { createInMemoryEmailPort } from '../test-support/in-memory-email-port.js';
import type { StaffRole } from '../data-access/types.js';

function buildTestApp() {
  const { port: checkInPort, seedBusiness } = createInMemoryCheckInPort();
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const { port: staffPort, addStaff } = createInMemoryStaffPort();
  const app = buildApp({ checkInPort, authPort, staffPort, emailPort: createInMemoryEmailPort().port, db: createDb('postgres://unused'), appUrl: 'http://test.local' }, { logger: false });

  function loginAsStaffOf(businessId: string, role: StaffRole = 'owner') {
    const authUserId = randomUUID();
    const staff = addStaff({ authUserId, businessId, role });
    return { headers: { authorization: `Bearer ${issueToken({ userId: authUserId, email: staff.email })}` } };
  }

  return { app, seedBusiness, loginAsStaffOf };
}

describe('GET /businesses/:slug/customers', () => {
  it('returns a paginated envelope for a signed-in staff member', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers',
      headers: loginAsStaffOf(business.id).headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ items: [], total: 0, page: 1, pageSize: 25 });
  });

  it('is reachable by any staff member, not just the owner', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers',
      headers: loginAsStaffOf(business.id, 'staff').headers,
    });

    expect(response.statusCode).toBe(200);
  });

  it('401s with no Authorization header', async () => {
    const { app, seedBusiness } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/customers' });

    expect(response.statusCode).toBe(401);
  });

  it('403s for staff of a different business', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const otherBusiness = await seedBusiness({ slug: 'other-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers',
      headers: loginAsStaffOf(otherBusiness.id).headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('400s for an invalid sort field', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers?sort=points%3B%20drop%20table%20customers',
      headers: loginAsStaffOf(business.id).headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('400s for an invalid sort direction', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers?dir=sideways',
      headers: loginAsStaffOf(business.id).headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('400s when pageSize exceeds the cap', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers?pageSize=1000',
      headers: loginAsStaffOf(business.id).headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('honors explicit page, pageSize, sort, and dir', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers?page=2&pageSize=5&sort=points&dir=asc',
      headers: loginAsStaffOf(business.id).headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ page: 2, pageSize: 5 });
  });
});

describe('GET /businesses/:slug/customers/export', () => {
  it('returns CSV with a header row and one row per customer, for the owner', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers/export',
      headers: loginAsStaffOf(business.id).headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);
    expect(response.body.split('\r\n')[0]).toBe(
      'Phone,Current points,Lifetime points,Rewards given,Joined,SMS Consent',
    );
  });

  it('403s for a non-owner staff member', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers/export',
      headers: loginAsStaffOf(business.id, 'staff').headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('401s with no Authorization header', async () => {
    const { app, seedBusiness } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/customers/export' });

    expect(response.statusCode).toBe(401);
  });

  it('403s for an owner of a different business', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const otherBusiness = await seedBusiness({ slug: 'other-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/customers/export',
      headers: loginAsStaffOf(otherBusiness.id).headers,
    });

    expect(response.statusCode).toBe(403);
  });
});
