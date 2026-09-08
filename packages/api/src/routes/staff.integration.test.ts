import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from '../data-access/kysely-staff-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import type { Database } from '../data-access/types.js';

async function seedBusinessWithOwner(db: Kysely<Database>) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Staff Routes Shop',
      slug: `staff-routes-${randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free item',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const authUserId = randomUUID();
  const owner = await db
    .insertInto('staff')
    .values({ business_id: business.id, email: 'owner@example.com', role: 'owner', auth_user_id: authUserId })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { business, owner, authUserId };
}

function buildStaffApp(realDb: Kysely<Database>) {
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const app = buildApp(
    { checkInPort: createKyselyCheckInPort(realDb), staffPort: createKyselyStaffPort(realDb), authPort, db: realDb },
    { logger: false },
  );
  return { app, issueToken };
}

describe('multi-staff accounts, end to end via HTTP', () => {
  test('owner invites, a fresh identity redeems, appears on the roster, can confirm, cannot open settings, gets deactivated, and can be re-invited', async ({
    realDb,
  }) => {
    const { business, authUserId: ownerAuthUserId } = await seedBusinessWithOwner(realDb);
    const { app, issueToken } = buildStaffApp(realDb);
    const ownerHeaders = { authorization: `Bearer ${issueToken({ userId: ownerAuthUserId, email: 'owner@example.com' })}` };

    // Owner creates an invite.
    const inviteResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/invites`,
      headers: ownerHeaders,
      payload: { role: 'staff' },
    });
    expect(inviteResponse.statusCode).toBe(201);
    const { code } = inviteResponse.json();

    // A brand-new identity signs up and redeems it.
    const newHireAuthUserId = randomUUID();
    const newHireHeaders = {
      authorization: `Bearer ${issueToken({ userId: newHireAuthUserId, email: 'new-hire@example.com' })}`,
    };
    const redeemResponse = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: newHireHeaders,
      payload: { code },
    });
    expect(redeemResponse.statusCode).toBe(200);
    expect(redeemResponse.json()).toMatchObject({ outcome: 'redeemed', businessId: business.id, role: 'staff' });

    // They now resolve as real staff of this business.
    const meResponse = await app.inject({ method: 'GET', url: '/me', headers: newHireHeaders });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({ role: 'staff', business: { id: business.id } });
    const newHireStaffId = meResponse.json().id;

    // They show up on the owner's roster.
    const rosterResponse = await app.inject({
      method: 'GET',
      url: `/businesses/${business.slug}/staff`,
      headers: ownerHeaders,
    });
    expect(rosterResponse.json().staff).toHaveLength(2);

    // They can confirm a check-in (ordinary staff capability)...
    const checkinResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/pending-checkins`,
      payload: { phone: '555-999-0020' },
    });
    const { id: pendingCheckinId } = checkinResponse.json();
    const confirmResponse = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pendingCheckinId}/confirm`,
      headers: newHireHeaders,
    });
    expect(confirmResponse.statusCode).toBe(200);

    // ...but cannot change business settings (owner-only).
    const settingsResponse = await app.inject({
      method: 'PATCH',
      url: `/businesses/${business.slug}`,
      headers: newHireHeaders,
      payload: { name: 'Hijacked Name', rewardThreshold: 1, rewardDescription: 'x' },
    });
    expect(settingsResponse.statusCode).toBe(403);

    // Owner deactivates them.
    const deactivateResponse = await app.inject({
      method: 'POST',
      url: `/staff/${newHireStaffId}/deactivate`,
      headers: ownerHeaders,
    });
    expect(deactivateResponse.statusCode).toBe(200);

    // They're locked out immediately.
    const lockedOutResponse = await app.inject({ method: 'GET', url: '/me', headers: newHireHeaders });
    expect(lockedOutResponse.statusCode).toBe(401);

    // Their earlier visit is untouched.
    const rosterAfterDeactivation = await app.inject({
      method: 'GET',
      url: `/businesses/${business.slug}/staff`,
      headers: ownerHeaders,
    });
    const deactivatedEntry = rosterAfterDeactivation
      .json()
      .staff.find((s: { id: string }) => s.id === newHireStaffId);
    expect(deactivatedEntry.deactivatedAt).not.toBeNull();

    // Re-invited to the same business, they resume their original id.
    const secondInvite = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/invites`,
      headers: ownerHeaders,
      payload: { role: 'staff' },
    });
    const rehireResponse = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: newHireHeaders,
      payload: { code: secondInvite.json().code },
    });
    expect(rehireResponse.statusCode).toBe(200);
    const meAfterRehire = await app.inject({ method: 'GET', url: '/me', headers: newHireHeaders });
    expect(meAfterRehire.json().id).toBe(newHireStaffId);
  });

  test('an owner cannot create an invite for another business', async ({ realDb }) => {
    const { authUserId: ownerAAuthUserId } = await seedBusinessWithOwner(realDb);
    const { business: businessB } = await seedBusinessWithOwner(realDb);
    const { app, issueToken } = buildStaffApp(realDb);
    const ownerAHeaders = { authorization: `Bearer ${issueToken({ userId: ownerAAuthUserId, email: 'owner-a@example.com' })}` };

    const response = await app.inject({
      method: 'POST',
      url: `/businesses/${businessB.slug}/invites`,
      headers: ownerAHeaders,
      payload: { role: 'staff' },
    });

    expect(response.statusCode).toBe(403);
  });

  test('an owner cannot deactivate another business\'s staff', async ({ realDb }) => {
    const { authUserId: ownerAAuthUserId } = await seedBusinessWithOwner(realDb);
    const { business: businessB } = await seedBusinessWithOwner(realDb);
    const bAuthUserId = randomUUID();
    const staffB = await realDb
      .insertInto('staff')
      .values({ business_id: businessB.id, email: 'staff-b@example.com', role: 'staff', auth_user_id: bAuthUserId })
      .returningAll()
      .executeTakeFirstOrThrow();
    const { app, issueToken } = buildStaffApp(realDb);
    const ownerAHeaders = { authorization: `Bearer ${issueToken({ userId: ownerAAuthUserId, email: 'owner-a@example.com' })}` };

    const response = await app.inject({
      method: 'POST',
      url: `/staff/${staffB.id}/deactivate`,
      headers: ownerAHeaders,
    });

    expect(response.statusCode).toBe(403);
  });
});
