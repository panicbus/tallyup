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
  const { port: emailPort, sent, failNextSend } = createInMemoryEmailPort();
  const app = buildApp(
    { checkInPort, authPort, staffPort, emailPort, db: createDb('postgres://unused'), appUrl: 'http://test.local' },
    { logger: false },
  );

  function loginAsStaffOf(businessId: string, role: StaffRole = 'owner') {
    const authUserId = randomUUID();
    const staff = addStaff({ authUserId, businessId, role });
    return {
      authUserId,
      staffId: staff.id,
      email: staff.email,
      headers: { authorization: `Bearer ${issueToken({ userId: authUserId, email: staff.email })}` },
    };
  }

  function loginAsFreshIdentity() {
    const authUserId = randomUUID();
    const email = `fresh-${authUserId}@example.com`;
    return { authUserId, email, headers: { authorization: `Bearer ${issueToken({ userId: authUserId, email })}` } };
  }

  /** Sends an invite through the route, then digs the one-time code back out
   * of the email the route sent (the response no longer carries it). */
  async function inviteViaApi(
    headers: Record<string, string>,
    input: { slug?: string; email: string; role?: StaffRole } = { email: 'invitee@example.com' },
  ) {
    const res = await app.inject({
      method: 'POST',
      url: `/businesses/${input.slug ?? 'test-shop'}/invites`,
      headers,
      payload: { email: input.email, role: input.role ?? 'staff' },
    });
    const body = res.json() as { id: string; email: string };
    const code = sent.at(-1)?.text.match(/token=([^\s]+)/)?.[1];
    return { statusCode: res.statusCode, id: body.id, email: body.email, code: code ? decodeURIComponent(code) : undefined };
  }

  return { app, staffPort, sent, failNextSend, seedBusiness, loginAsStaffOf, loginAsFreshIdentity, inviteViaApi };
}

describe('POST /businesses/:slug/invites', () => {
  it('creates an invite and emails a join link to the invited address, without returning the code', async () => {
    const { app, sent, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: loginAsStaffOf(business.id).headers,
      payload: { email: 'New.Hire@example.com', role: 'staff' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).not.toHaveProperty('code');
    expect(body).toMatchObject({ email: 'new.hire@example.com' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('new.hire@example.com');
    expect(sent[0]?.text).toContain('http://test.local/join?token=');
  });

  it('403s for a non-owner staff member', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: loginAsStaffOf(business.id, 'staff').headers,
      payload: { email: 'x@example.com', role: 'staff' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('401s with no Authorization header', async () => {
    const { app, seedBusiness } = buildTestApp();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      payload: { email: 'x@example.com', role: 'staff' },
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
      payload: { email: 'x@example.com', role: 'superadmin' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('400s for a missing or malformed email', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { headers } = loginAsStaffOf(business.id);

    const missing = await app.inject({ method: 'POST', url: '/businesses/test-shop/invites', headers, payload: { role: 'staff' } });
    const malformed = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers,
      payload: { email: 'not-an-email', role: 'staff' },
    });

    expect(missing.statusCode).toBe(400);
    expect(malformed.statusCode).toBe(400);
  });

  it('502s with email_failed when the invitation cannot be sent', async () => {
    const { app, sent, failNextSend, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    failNextSend('provider down');

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/invites',
      headers: loginAsStaffOf(business.id).headers,
      payload: { email: 'x@example.com', role: 'staff' },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: 'email_failed' });
    // The compensating revoke means nothing is left pending.
    const roster = await app.inject({
      method: 'GET',
      url: '/businesses/test-shop/staff',
      headers: loginAsStaffOf(business.id).headers,
    });
    expect(roster.json().pendingInvites).toEqual([]);
    expect(sent).toHaveLength(0);
  });

  it('rate limits repeated invite sends from one caller', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { headers } = loginAsStaffOf(business.id);

    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/businesses/test-shop/invites',
        headers,
        payload: { email: `hire-${i}@example.com`, role: 'staff' },
      });
      codes.push(res.statusCode);
    }

    expect(codes).toContain(429);
  });
});

describe('POST /invites/lookup', () => {
  it('describes a live invite: shop, slug, inviter, role, invited email', async () => {
    const { app, seedBusiness, loginAsStaffOf, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    const invite = await inviteViaApi(owner.headers, { email: 'invitee@example.com', role: 'owner' });

    const response = await app.inject({ method: 'POST', url: '/invites/lookup', payload: { code: invite.code } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      role: 'owner',
      email: 'invitee@example.com',
      invitedBy: owner.email,
    });
    expect(response.json()).toHaveProperty('businessName');
    expect(response.json()).toHaveProperty('businessSlug');
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('404s for an unknown code', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: 'POST', url: '/invites/lookup', payload: { code: 'not-a-real-code' } });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'invalid_code' });
  });

  it('needs no Authorization header', async () => {
    const { app, seedBusiness, loginAsStaffOf, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const invite = await inviteViaApi(loginAsStaffOf(business.id).headers, { email: 'invitee@example.com' });

    const response = await app.inject({ method: 'POST', url: '/invites/lookup', payload: { code: invite.code } });

    expect(response.statusCode).toBe(200);
  });

  it('400s for a missing code', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: 'POST', url: '/invites/lookup', payload: {} });

    expect(response.statusCode).toBe(400);
  });
});

describe('GET /businesses/:slug/staff', () => {
  it('shows the owner names, emails, and pending invites, with the invited address', async () => {
    const { app, seedBusiness, loginAsStaffOf, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { headers } = loginAsStaffOf(business.id);
    await inviteViaApi(headers, { email: 'pending@example.com' });

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/staff', headers });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.staff[0]).toHaveProperty('email');
    expect(body.staff[0]).toHaveProperty('name');
    expect(body.pendingInvites).toHaveLength(1);
    expect(body.pendingInvites[0].email).toBe('pending@example.com');
  });

  it('gives a non-owner the team list (names and emails) but not pending invites', async () => {
    const { app, seedBusiness, loginAsStaffOf, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    await inviteViaApi(owner.headers, { email: 'pending@example.com' });
    const staffMember = loginAsStaffOf(business.id, 'staff');

    const response = await app.inject({ method: 'GET', url: '/businesses/test-shop/staff', headers: staffMember.headers });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.staff.length).toBeGreaterThan(0);
    expect(body.staff.every((s: { email?: string }) => typeof s.email === 'string')).toBe(true);
    expect(body.staff[0]).toHaveProperty('name');
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

describe('POST /invites/:id/revoke', () => {
  it('lets the owner revoke a pending invite, and the code is then dead', async () => {
    const { app, seedBusiness, loginAsStaffOf, loginAsFreshIdentity, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    const newHire = loginAsFreshIdentity();
    const invite = await inviteViaApi(owner.headers, { email: newHire.email });

    const revoke = await app.inject({ method: 'POST', url: `/invites/${invite.id}/revoke`, headers: owner.headers });
    expect(revoke.statusCode).toBe(200);

    const redeem = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: newHire.headers,
      payload: { code: invite.code },
    });
    expect(redeem.statusCode).toBe(400);

    const roster = await app.inject({ method: 'GET', url: '/businesses/test-shop/staff', headers: owner.headers });
    expect(roster.json().pendingInvites).toEqual([]);
  });

  it('403s for a non-owner staff member', async () => {
    const { app, seedBusiness, loginAsStaffOf, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const invite = await inviteViaApi(loginAsStaffOf(business.id).headers, { email: 'x@example.com' });

    const response = await app.inject({
      method: 'POST',
      url: `/invites/${invite.id}/revoke`,
      headers: loginAsStaffOf(business.id, 'staff').headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it("404s an owner trying to revoke another business's invite", async () => {
    const { app, seedBusiness, loginAsStaffOf, inviteViaApi } = buildTestApp();
    const businessA = await seedBusiness({ slug: 'shop-a', rewardThreshold: 10 });
    const businessB = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const inviteB = await inviteViaApi(loginAsStaffOf(businessB.id).headers, { email: 'x@example.com' });

    const response = await app.inject({
      method: 'POST',
      url: `/invites/${inviteB.id}/revoke`,
      headers: loginAsStaffOf(businessA.id).headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('404s for an unknown invite id', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const response = await app.inject({
      method: 'POST',
      url: `/invites/${randomUUID()}/revoke`,
      headers: loginAsStaffOf(business.id).headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('401s with no Authorization header', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: 'POST', url: `/invites/${randomUUID()}/revoke` });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /invites/redeem', () => {
  it('redeems a valid code for a fresh identity whose email matches the invited address', async () => {
    const { app, seedBusiness, loginAsStaffOf, loginAsFreshIdentity, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    const newHire = loginAsFreshIdentity();
    const invite = await inviteViaApi(owner.headers, { email: newHire.email, role: 'staff' });

    const response = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: newHire.headers,
      payload: { code: invite.code },
    });

    expect(response.statusCode).toBe(200);
  });

  it('403s with wrong_account when the signed-in email differs, and the invite stays redeemable', async () => {
    const { app, seedBusiness, loginAsStaffOf, loginAsFreshIdentity, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    const invite = await inviteViaApi(owner.headers, { email: 'intended@example.com', role: 'staff' });

    const wrong = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: loginAsFreshIdentity().headers,
      payload: { code: invite.code },
    });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toEqual({ error: 'wrong_account' });

    const intended = loginAsFreshIdentity();
    // Reissue with the intended address matching this identity.
    const forThem = await inviteViaApi(owner.headers, { email: intended.email, role: 'staff' });
    const ok = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: intended.headers,
      payload: { code: forThem.code },
    });
    expect(ok.statusCode).toBe(200);
  });

  it('400s for an invalid code', async () => {
    const { app, loginAsFreshIdentity } = buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: loginAsFreshIdentity().headers,
      payload: { code: 'not-a-real-code' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('409s for an identity that already has an active staff row', async () => {
    const { app, seedBusiness, loginAsStaffOf, inviteViaApi } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const owner = loginAsStaffOf(business.id);
    const invite = await inviteViaApi(owner.headers, { email: owner.email, role: 'staff' });

    const response = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: owner.headers,
      payload: { code: invite.code },
    });

    expect(response.statusCode).toBe(409);
  });

  it('401s with no Authorization header', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: 'POST', url: '/invites/redeem', payload: { code: 'x' } });

    expect(response.statusCode).toBe(401);
  });
});
