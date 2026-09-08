import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { getCheckinStatus } from './checkin-status.js';

describe('getCheckinStatus', () => {
  it('reports pending before confirmation', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });

    const status = await getCheckinStatus(port, pending.id);

    expect(status).toEqual({ status: 'pending', expiresAt: pending.expiresAt });
  });

  it('reports confirmed with eligibility, after confirmation', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 1 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: randomUUID() });

    const status = await getCheckinStatus(port, pending.id);

    expect(status).toMatchObject({
      status: 'confirmed',
      customer: { points: 1 },
      eligibleForRedemption: true,
    });
  });

  it('never includes the raw phone number, even though it is the customer\'s own', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: randomUUID() });

    const status = await getCheckinStatus(port, pending.id);

    expect(status).toMatchObject({ status: 'confirmed' });
    if (status.status === 'confirmed') {
      expect(status.customer).not.toHaveProperty('phone');
    }
  });

  it('reports not_found for a confirmed check-in past the visibility window — never a live points read', async () => {
    const { port, seedBusiness, seedStaleConfirmedPendingCheckin } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pendingCheckinId = await seedStaleConfirmedPendingCheckin({
      businessId: business.id,
      phone: '+15551234567',
    });

    expect(await getCheckinStatus(port, pendingCheckinId)).toEqual({ status: 'not_found' });
  });

  it('reports not_found for an unknown id', async () => {
    const { port } = createInMemoryCheckInPort();

    expect(await getCheckinStatus(port, randomUUID())).toEqual({ status: 'not_found' });
  });
});
