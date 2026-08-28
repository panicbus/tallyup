import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { redeem } from './redemption.js';

async function checkInNTimes(port: ReturnType<typeof createInMemoryCheckInPort>['port'], businessId: string, phone: string, n: number) {
  let customerId = '';
  for (let i = 0; i < n; i++) {
    const pending = await port.createPendingCheckin({ businessId, phone });
    const result = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: randomUUID() });
    if (result.outcome === 'confirmed') customerId = result.customer.id;
  }
  return customerId;
}

describe('redeem', () => {
  it('redeems exactly at the threshold, landing at 0 with no further eligibility', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const customerId = await checkInNTimes(port, business.id, '+15551234567', 10);

    const result = await redeem(port, { customerId, confirmedBy: randomUUID() });

    expect(result).toEqual({
      outcome: 'redeemed',
      customer: { id: expect.any(String), phone: '•••-•••-4567', points: 0 },
      business: { id: business.id, name: business.name, rewardThreshold: 10, rewardDescription: business.rewardDescription },
      eligibleForRedemption: false,
    });
  });

  it('keeps the rollover remainder and reports eligibility again above double the threshold', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const customerId = await checkInNTimes(port, business.id, '+15551234567', 12);

    const result = await redeem(port, { customerId, confirmedBy: randomUUID() });

    expect(result).toMatchObject({ outcome: 'redeemed', customer: { points: 2 }, eligibleForRedemption: false });
  });

  it('reports eligible again immediately when the remainder still qualifies', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const customerId = await checkInNTimes(port, business.id, '+15551234567', 20);

    const result = await redeem(port, { customerId, confirmedBy: randomUUID() });

    expect(result).toMatchObject({ outcome: 'redeemed', customer: { points: 10 }, eligibleForRedemption: true });
  });

  it('only redeems once per tap even when eligible for two', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const customerId = await checkInNTimes(port, business.id, '+15551234567', 25);

    const result = await redeem(port, { customerId, confirmedBy: randomUUID() });

    expect(result).toMatchObject({ customer: { points: 15 } });
  });

  it('returns not_eligible below the threshold', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const customerId = await checkInNTimes(port, business.id, '+15551234567', 5);

    const result = await redeem(port, { customerId, confirmedBy: randomUUID() });

    expect(result).toEqual({ outcome: 'not_eligible' });
  });

  it('returns not_eligible on a second redeem attempt (the fraud gate)', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const customerId = await checkInNTimes(port, business.id, '+15551234567', 10);

    const first = await redeem(port, { customerId, confirmedBy: randomUUID() });
    const second = await redeem(port, { customerId, confirmedBy: randomUUID() });

    expect(first.outcome).toBe('redeemed');
    expect(second).toEqual({ outcome: 'not_eligible' });
  });

  it('returns not_eligible for an unknown customer', async () => {
    const { port } = createInMemoryCheckInPort();

    const result = await redeem(port, { customerId: randomUUID(), confirmedBy: randomUUID() });

    expect(result).toEqual({ outcome: 'not_eligible' });
  });
});
