import { describe, expect, it } from 'vitest';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { listAllCustomersForExport, listCustomers } from './customers.js';

describe('listCustomers', () => {
  it('masks the phone and renames it, same convention as the check-in queue', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });

    const page = await listCustomers(port, { businessId: business.id, page: 1, pageSize: 25, sort: 'joined', dir: 'desc' });

    expect(page.items).toEqual([
      { id: expect.any(String), maskedPhone: '•••-•••-4567', points: 1, joinedAt: expect.any(Date), hasSmsConsent: false },
    ]);
  });

  it('carries the pagination envelope through unchanged', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });

    const page = await listCustomers(port, { businessId: business.id, page: 2, pageSize: 5, sort: 'points', dir: 'asc' });

    expect(page).toMatchObject({ total: 0, page: 2, pageSize: 5 });
  });

  it('reflects sms consent per customer', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });
    await port.recordConsent({
      businessId: business.id,
      phone: '+15551234567',
      language: 'Test consent language',
      ip: null,
      userAgent: null,
    });

    const page = await listCustomers(port, { businessId: business.id, page: 1, pageSize: 25, sort: 'joined', dir: 'desc' });

    expect(page.items[0]?.hasSmsConsent).toBe(true);
  });
});

describe('listAllCustomersForExport', () => {
  it('masks phones the same way listCustomers does, for every customer with no pagination', async () => {
    const { port, seedBusiness } = createInMemoryCheckInPort();
    const business = await seedBusiness({ slug: 'test-shop', rewardThreshold: 10 });
    const first = await port.createPendingCheckin({ businessId: business.id, phone: '+15551234567' });
    await port.confirmCheckin({ pendingCheckinId: first.id, confirmedBy: business.confirmedBy });
    const second = await port.createPendingCheckin({ businessId: business.id, phone: '+15559876543' });
    await port.confirmCheckin({ pendingCheckinId: second.id, confirmedBy: business.confirmedBy });

    const all = await listAllCustomersForExport(port, business.id);

    expect(all).toHaveLength(2);
    expect(all.every((c) => c.maskedPhone.startsWith('•••-•••-'))).toBe(true);
  });
});
