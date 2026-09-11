import { describe, expect, it } from 'vitest';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { getCustomerCards } from './customer-cards.js';

describe('getCustomerCards', () => {
  it('reports eligibility alongside each card', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 1 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: 'staff-1' });

    const cards = await getCustomerCards(port, '+15551234567');

    expect(cards).toEqual([
      {
        businessName: business.name,
        businessSlug: 'test-shop',
        logoUrl: null,
        rewardThreshold: 1,
        rewardDescription: business.rewardDescription,
        points: 1,
        eligibleForRedemption: true,
      },
    ]);
  });

  it('reports not eligible below the threshold', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: 'staff-1' });

    const cards = await getCustomerCards(port, '+15551234567');

    expect(cards[0]).toMatchObject({ eligibleForRedemption: false });
  });

  it('returns [] for a phone with no history, never an error', async () => {
    const { port } = createInMemoryCheckInPort();

    expect(await getCustomerCards(port, '+15559999999')).toEqual([]);
  });
});
