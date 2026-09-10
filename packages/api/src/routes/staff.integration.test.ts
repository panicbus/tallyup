import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from '../data-access/kysely-staff-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import { createInMemoryEmailPort } from '../test-support/in-memory-email-port.js';
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
  const { port: emailPort, sent } = createInMemoryEmailPort();
  const app = buildApp(
    {
      checkInPort: createKyselyCheckInPort(realDb),
      staffPort: createKyselyStaffPort(realDb),
      authPort,
      emailPort,
      db: realDb,
      appUrl: 'http://test.local',
    },
    { logger: false },
  );
  return { app, issueToken, sent };
}

/** The one-time code the invite route only ever puts in the emailed link. */
function codeFromLastEmail(sent: { text: string }[]): string {
  const token = sent.at(-1)?.text.match(/token=([^\s]+)/)?.[1];
  if (!token) throw new Error('no invite email was sent');
  return decodeURIComponent(token);
}

describe('multi-staff accounts, end to end via HTTP', () => {
  test('owner invites by email, the link is looked up then redeemed by the right account, and the flow runs through deactivation and re-invite', async ({
    realDb,
  }) => {
    const { business, authUserId: ownerAuthUserId } = await seedBusinessWithOwner(realDb);
    const { app, issueToken, sent } = buildStaffApp(realDb);
    const ownerHeaders = { authorization: `Bearer ${issueToken({ userId: ownerAuthUserId, email: 'owner@example.com' })}` };

    // Owner invites a teammate by email. The response carries no code.
    const inviteResponse = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/invites`,
      headers: ownerHeaders,
      payload: { email: 'new-hire@example.com', role: 'staff' },
    });
    expect(inviteResponse.statusCode).toBe(201);
    expect(inviteResponse.json()).not.toHaveProperty('code');
    expect(sent.at(-1)?.to).toBe('new-hire@example.com');
    const code = codeFromLastEmail(sent);

    // The join page looks the invite up without any auth.
    const lookupResponse = await app.inject({ method: 'POST', url: '/invites/lookup', payload: { code } });
    expect(lookupResponse.statusCode).toBe(200);
    expect(lookupResponse.json()).toMatchObject({
      businessSlug: business.slug,
      role: 'staff',
      email: 'new-hire@example.com',
      invitedBy: 'owner@example.com',
    });

    // The wrong account cannot spend it, and the attempt does not burn it.
    const wrongAccount = {
      authorization: `Bearer ${issueToken({ userId: randomUUID(), email: 'someone-else@example.com' })}`,
    };
    const wrongRedeem = await app.inject({ method: 'POST', url: '/invites/redeem', headers: wrongAccount, payload: { code } });
    expect(wrongRedeem.statusCode).toBe(403);
    expect(wrongRedeem.json()).toEqual({ error: 'wrong_account' });

    // The intended identity signs up and redeems it.
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

    // They show up on the owner's roster with the invited address.
    const rosterResponse = await app.inject({
      method: 'GET',
      url: `/businesses/${business.slug}/staff`,
      headers: ownerHeaders,
    });
    expect(rosterResponse.json().staff).toHaveLength(2);
    expect(
      rosterResponse.json().staff.find((s: { id: string }) => s.id === newHireStaffId).email,
    ).toBe('new-hire@example.com');

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

    // Re-invited to the same business, they resume their original id.
    const secondInvite = await app.inject({
      method: 'POST',
      url: `/businesses/${business.slug}/invites`,
      headers: ownerHeaders,
      payload: { email: 'new-hire@example.com', role: 'staff' },
    });
    expect(secondInvite.statusCode).toBe(201);
    const rehireResponse = await app.inject({
      method: 'POST',
      url: '/invites/redeem',
      headers: newHireHeaders,
      payload: { code: codeFromLastEmail(sent) },
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
      payload: { email: 'x@example.com', role: 'staff' },
    });

    expect(response.statusCode).toBe(403);
  });

  test("an owner cannot deactivate another business's staff", async ({ realDb }) => {
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
