import { describe, expect, it } from 'vitest';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { getRecentBusinessStats } from './stats.js';

describe('getRecentBusinessStats', () => {
  it('reports trailing-week check-ins, new customers, and rewards', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 1 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    const confirmed = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: 'staff-1' });
    if (confirmed.outcome === 'confirmed') {
      await port.redeem({ customerId: confirmed.customer.id, confirmedBy: 'staff-1' });
    }

    const stats = await getRecentBusinessStats(port, business.id);

    expect(stats).toEqual({ checkins: 1, newCustomers: 1, rewards: 1, windowDays: 7 });
  });

  it('drops activity older than the window — the cutoff is 7 days before `now`', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: 'staff-1' });

    const eightDaysLater = Date.now() + 8 * 24 * 60 * 60 * 1000;
    const stats = await getRecentBusinessStats(port, business.id, eightDaysLater);

    expect(stats).toMatchObject({ checkins: 0, newCustomers: 0, rewards: 0 });
  });
});
