import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../data-access/db.js';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import { createInMemoryStaffPort } from '../test-support/in-memory-staff-port.js';
import type { StaffRole } from '../data-access/types.js';

function buildTestApp() {
  const { port: checkInPort, seedBusiness } = createInMemoryCheckInPort();
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const { port: staffPort, addStaff } = createInMemoryStaffPort();
  const app = buildApp({ checkInPort, authPort, staffPort, db: createDb('postgres://unused') }, { logger: false });

  function loginAsStaffOf(businessId: string, role: StaffRole = 'owner') {
    const authUserId = randomUUID();
    const staff = addStaff({ authUserId, businessId, role });
    return {
      authUserId,
      staffId: staff.id,
      headers: { authorization: `Bearer ${issueToken({ userId: authUserId, email: staff.email })}` },
    };
  }

  function loginAsFreshIdentity() {
    const authUserId = randomUUID();
    const email = `fresh-${authUserId}@example.com`;
    return { authUserId, email, headers: { authorization: `Bearer ${issueToken({ userId: authUserId, email })}` } };
  }

  return { app, staffPort, seedBusiness, loginAsStaffOf, loginAsFreshIdentity };
}

describe('POST /businesses/:slug/invites', () => {
  it('creates an invite for the owner, returning the plaintext code once', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: loginAsStaffOf(business.id).headers,
      payload: { role: 'staff' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('code');
  });

  it('403s for a non-owner staff member', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: loginAsStaffOf(business.id, 'staff').headers,
      payload: { role: 'staff' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('401s with no Authorization header', async () => {
    const { app, seedBusiness } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      payload: { role: 'staff' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('400s for an invalid role', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: loginAsStaffOf(business.id).headers,
      payload: { role: 'superadmin' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('GET /businesses/:slug/staff', () => {
  it('shows the owner emails and pending invites', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { headers } = loginAsStaffOf(business.id);
    await app.inject({ method: 'POST', url: '/businesses/test-shop/invites', headers, payload: { role: 'staff' } });

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/staff', headers });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.staff[0]).toHaveProperty('email');
    expect(body.pendingInvites).toHaveLength(1);
  });

  it('hides emails and pending invites from a non-owner staff member', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: owner.headers,
      payload: { role: 'staff' },
    });
    const staffMember = loginAsStaffOf(business.id, 'staff');

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/staff', headers: staffMember.headers });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.staff.every((s: { email?: string }) => s.email === undefined)).toBe(true);
    expect(body.pendingInvites).toBeUndefined();
  });

  it('401s with no Authorization header', async () => {
    const { app, seedBusiness } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/staff' });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /staff/:id/deactivate', () => {
  it('deactivates a staff member for the owner', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    const employee = loginAsStaffOf(business.id, 'staff');

    const response = await app.inject({
      method: 'POST',
      url: `/staff/${employee.staffId}/deactivate`,
      headers: owner.headers,
    });

    expect(response.statusCode).toBe(200);
  });

  it('403s for a non-owner staff member', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const staffMember = loginAsStaffOf(business.id, 'staff');
    const otherEmployee = loginAsStaffOf(business.id, 'staff');

    const response = await app.inject({
      method: 'POST',
      url: `/staff/${otherEmployee.staffId}/deactivate`,
      headers: staffMember.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it("403s an owner trying to deactivate another business's staff", async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const businessA = await seedBusiness({ slug: 'shop-a', rewardThreshold: 10 });
    const businessB = await seedBusiness({ slug: 'shop-b', rewardThreshold: 10 });
    const ownerA = loginAsStaffOf(businessA.id);
    const staffOfB = loginAsStaffOf(businessB.id, 'staff');

    const response = await app.inject({
      method: 'POST',
      url: `/staff/${staffOfB.staffId}/deactivate`,
      headers: ownerA.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('404s for an unknown staff id', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);

    const response = await app.inject({
      method: 'POST',
      url: `/staff/${randomUUID()}/deactivate`,
      headers: owner.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('409s when deactivating the last active owner', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);

    const response = await app.inject({
      method: 'POST',
      url: `/staff/${owner.staffId}/deactivate`,
      headers: owner.headers,
    });

    expect(response.statusCode).toBe(409);
  });

  it('401s with no Authorization header', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: 'POST', url: `/staff/${randomUUID()}/deactivate` });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /invites/redeem', () => {
  it('redeems a valid code for a freshly authenticated identity', async () => {
    const { app, seedBusiness, loginAsStaffOf, loginAsFreshIdentity } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: owner.headers,
      payload: { role: 'staff' },
    });
    const { code } = createResponse.json();
    const newHire = loginAsFreshIdentity();

    const response = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: newHire.headers,
      payload: { code },
    });

    expect(response.statusCode).toBe(200);
  });

  it('400s for an invalid code', async () => {
    const { app, loginAsFreshIdentity } = buildTestApp();
    const newHire = loginAsFreshIdentity();

    const response = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: newHire.headers,
      payload: { code: 'not-a-real-code' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('409s for an identity that already has an active staff row', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: owner.headers,
      payload: { role: 'staff' },
    });
    const { code } = createResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: owner.headers,
      payload: { code },
    });

    expect(response.statusCode).toBe(409);
  });

  it('401s with no Authorization header', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: 'POST', url: '/invites/redeem', payload: { code: 'x' } });

    expect(response.statusCode).toBe(401);
  });
});
