import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { confirmCheckin, listPendingCheckins } from './check-in.js';

describe('confirmCheckin', () => {
  it('confirms a new customer at 1 point', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const result = await confirmCheckin(port, { pendingCheckinId: pending.id, confirmedBy: randomUUID() });

    expect(result).toMatchObject({
      outcome: 'confirmed',
      customer: { phone: '•••-•••-4567', points: 1 },
      eligibleForRedemption: false,
    });
  });

  it('increments points for a returning customer', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const firstVisit = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await confirmCheckin(port, { pendingCheckinId: firstVisit.id, confirmedBy: randomUUID() });

    const secondVisit = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    const result = await confirmCheckin(port, { pendingCheckinId: secondVisit.id, confirmedBy: randomUUID() });

    expect(result).toMatchObject({ outcome: 'confirmed', customer: { points: 2 } });
  });

  it('reports eligibility once points reach the threshold', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 1 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const result = await confirmCheckin(port, { pendingCheckinId: pending.id, confirmedBy: randomUUID() });

    expect(result).toMatchObject({ outcome: 'confirmed', eligibleForRedemption: true });
  });

  it('returns not_found for an unknown pending check-in', async () => {
    const { port } = createInMemoryCheckInPort();

    const result = await confirmCheckin(port, { pendingCheckinId: randomUUID(), confirmedBy: randomUUID() });

    expect(result).toEqual({ outcome: 'not_found' });
  });

  it('returns not_found on a second confirm of the same pending check-in (the fraud gate)', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const first = await confirmCheckin(port, { pendingCheckinId: pending.id, confirmedBy: randomUUID() });
    const second = await confirmCheckin(port, { pendingCheckinId: pending.id, confirmedBy: randomUUID() });

    expect(first.outcome).toBe('confirmed');
    expect(second).toEqual({ outcome: 'not_found' });
  });

  it('returns not_found for an expired pending check-in', async () => {
    const { port, seedBusiness, seedExpiredPendingCheckin } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pendingCheckinId = await seedExpiredPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const result = await confirmCheckin(port, { pendingCheckinId, confirmedBy: randomUUID() });

    expect(result).toEqual({ outcome: 'not_found' });
  });
});

describe('listPendingCheckins', () => {
  it('masks phone numbers, oldest first', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const first = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    const second = await port.createPendingCheckin({ businessId: business.id, phone: '+15559876543' });

    const queue = await listPendingCheckins(port, business.id);

    expect(queue).toEqual([
      { id: first.id, maskedPhone: '•••-•••-4567', createdAt: expect.any(Date) },
      { id: second.id, maskedPhone: '•••-•••-6543', createdAt: expect.any(Date) },
    ]);
  });

  it('is empty for a business with no pending check-ins', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    expect(await listPendingCheckins(port, business.id)).toEqual([]);
  });
});
