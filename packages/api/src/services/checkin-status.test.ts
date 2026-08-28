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
      customer: { phone: '+15551234567', points: 1 },
      eligibleForRedemption: true,
    });
  });

  it('reports not_found for an unknown id', async () => {
    const { port } = createInMemoryCheckInPort();

    expect(await getCheckinStatus(port, randomUUID())).toEqual({ status: 'not_found' });
  });
});
