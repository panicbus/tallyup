import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';

describe('POST /businesses/:slug/pending-checkins', () => {
  it('creates a pending check-in for a known business', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const app = buildApp({ checkInPort: port }, { logger: false });

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
    const app = buildApp({ checkInPort: port }, { logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/test-shop/pending-checkins',
      payload: { phone: 'not a phone' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('404s for an unknown business slug', async () => {
    const { port } = createInMemoryCheckInPort();
    const app = buildApp({ checkInPort: port }, { logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/businesses/no-such-shop/pending-checkins',
      payload: { phone: '555-123-4567' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /pending-checkins/:id/confirm', () => {
  it('confirms a pending check-in', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const app = buildApp({ checkInPort: port }, { logger: false });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const response = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pending.id}/confirm`,
      payload: { confirmedBy: business.confirmedBy },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ outcome: 'confirmed', customer: { points: 1 } });
  });

  it('404s confirming an unknown pending check-in', async () => {
    const { port } = createInMemoryCheckInPort();
    const app = buildApp({ checkInPort: port }, { logger: false });

    const response = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${randomUUID()}/confirm`,
      payload: { confirmedBy: randomUUID() },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects a non-uuid confirmedBy', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const app = buildApp({ checkInPort: port }, { logger: false });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const response = await app.inject({
      method: 'POST',
      url: `/pending-checkins/${pending.id}/confirm`,
      payload: { confirmedBy: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /customers/:id/redeem', () => {
  it('redeems for an eligible customer', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 1 });
    const app = buildApp({ checkInPort: port }, { logger: false });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    const confirmResult = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });
    if (confirmResult.outcome !== 'confirmed') throw new Error('setup failed');

    const response = await app.inject({
      method: 'POST',
      url: `/customers/${confirmResult.customer.id}/redeem`,
      payload: { confirmedBy: business.confirmedBy },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ outcome: 'redeemed', customer: { points: 0 } });
  });

  it('409s when not eligible', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const app = buildApp({ checkInPort: port }, { logger: false });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    const confirmResult = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });
    if (confirmResult.outcome !== 'confirmed') throw new Error('setup failed');

    const response = await app.inject({
      method: 'POST',
      url: `/customers/${confirmResult.customer.id}/redeem`,
      payload: { confirmedBy: business.confirmedBy },
    });

    expect(response.statusCode).toBe(409);
  });

  it('rejects a non-uuid confirmedBy', async () => {
    const { port } = createInMemoryCheckInPort();
    const app = buildApp({ checkInPort: port }, { logger: false });

    const response = await app.inject({
      method: 'POST',
      url: `/customers/${randomUUID()}/redeem`,
      payload: { confirmedBy: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });
});
