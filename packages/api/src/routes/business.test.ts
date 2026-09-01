import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  // Returns authUserId alongside the header because the logo-URL guard
  // checks the URL's folder against exactly that id.
  function loginAsStaffOf(businessId: string) {
    const authUserId = randomUUID();
    const staff = addStaff({ authUserId, businessId });
    return {
      authUserId,
      headers: { authorization: `Bearer ${issueToken({ userId: authUserId, email: staff.email })}` },
    };
  }

  return { app, seedBusiness, loginAsStaffOf };
}

const validBody = { name: 'New Name', rewardThreshold: 5, rewardDescription: 'New reward' };

const SUPABASE_URL = 'https://test-project.supabase.co';

function logoUrlFor(authUserId: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/business-logos/${authUserId}/logo.png`;
}

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
      headers: loginAsStaffOf(otherBusiness.id).headers,
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
      headers: loginAsStaffOf(business.id).headers,
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
      headers: loginAsStaffOf(business.id).headers,
      payload: { name: '', rewardThreshold: 0, rewardDescription: '' },
    });

    expect(response.statusCode).toBe(400);
  });
});

/**
 * The logo-URL trust boundary. Image bytes never pass through this API — the
 * browser uploads straight to Supabase Storage and posts back a URL — so
 * these branches are the only thing stopping a staff member from recording
 * an arbitrary host, or another shop's object, as their logo.
 */
describe('PATCH /businesses/:slug logo URL validation', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('400s for a logo URL in another user’s storage folder', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { headers } = loginAsStaffOf(business.id);

    const response = await app.inject({
      method: 'PATCH',
      url: '/businesses/test-shop',
      headers,
      payload: { ...validBody, logoUrl: logoUrlFor(randomUUID()) },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_logo_url' });
  });

  it('400s for a logo URL on a foreign host', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { authUserId, headers } = loginAsStaffOf(business.id);

    const response = await app.inject({
      method: 'PATCH',
      url: '/businesses/test-shop',
      headers,
      payload: {
        ...validBody,
        logoUrl: `https://evil.example.com/storage/v1/object/public/business-logos/${authUserId}/logo.png`,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_logo_url' });
  });

  it('accepts a null logoUrl without consulting storage at all', async () => {
    const { app, seedBusiness, loginAsStaffOf } = buildTestApp();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const { headers } = loginAsStaffOf(business.id);

    const response = await app.inject({
      method: 'PATCH',
      url: '/businesses/test-shop',
      headers,
      payload: { ...validBody, logoUrl: null },
    });

    // Past validation it reaches updateBusiness against the unused db, so
    // the only thing asserted here is that it wasn't rejected as invalid.
    expect(response.json()).not.toEqual({ error: 'invalid_logo_url' });
  });
});
