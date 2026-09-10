import { describe, expect } from 'vitest';
import type { Business, CheckInPort } from '../data-access/check-in-port.js';

export interface CheckInPortContractSetup {
  port: CheckInPort;
  seedBusiness(input: {
    slug: string;
    rewardThreshold: number;
    logoUrl?: string | null;
  }): Promise<Business & { confirmedBy: string }>;
  seedExpiredPendingCheckin(input: { businessId: string; phone: string }): Promise<string>;
  seedStaleConfirmedPendingCheckin(input: { businessId: string; phone: string }): Promise<string>;
}

// Generic over the fixture shape: this runs against both a plain vitest
// `test` (fake adapter, fixtures type `{}`) and the realDb-fixture-extended
// `test` from integration-test.ts (real adapter — confirmCheckin opens its
// own transaction, so it needs the non-transactional `realDb` fixture, not
// the rollback-wrapped `db` one). Vitest's extended test determines which
// fixtures to build by statically parsing the callback's destructured
// parameter names, so every test body below must destructure `{ realDb }`
// literally (not a generic `context` param) — the fake path simply
// receives `realDb: undefined` and ignores it, since its createSetup takes
// no arguments.
type TestFn<Fixtures> = (name: string, fn: (fixtures: Fixtures) => Promise<void>) => void;

/**
 * Behavioral assertions run against any CheckInPort implementation. Invoked
 * once for the in-memory fake and once for the real Kysely adapter so
 * neither can silently drift from the other — see in-memory-check-in-port
 * .test.ts and kysely-check-in-port.integration.test.ts.
 */
export function runCheckInPortContractTests<Fixtures extends { realDb?: unknown }>(
  test: TestFn<Fixtures>,
  createSetup: (fixtures: Fixtures) => Promise<CheckInPortContractSetup>,
): void {
  describe('CheckInPort contract', () => {
    test('confirms a new customer at 1 point', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230001' });

      const result = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });

      expect(result).toMatchObject({ outcome: 'confirmed', customer: { phone: '+15551230001', points: 1 } });
    });

    test('a second confirm of the same pending check-in fails (the fraud gate)', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230002' });

      const first = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });
      const second = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });

      expect(first.outcome).toBe('confirmed');
      expect(second).toEqual({ outcome: 'not_found' });
    });

    test('resubmitting the same phone refreshes the existing pending row, not a new one', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });

      const first = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230003' });
      const second = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230003' });

      expect(second.id).toBe(first.id);
      expect(second.expiresAt.getTime()).toBeGreaterThanOrEqual(first.expiresAt.getTime());
    });

    test('an unknown pending check-in returns not_found', async ({ realDb }) => {
      const { port } = await createSetup({ realDb } as Fixtures);

      const result = await port.confirmCheckin({
        pendingCheckinId: crypto.randomUUID(),
        confirmedBy: crypto.randomUUID(),
      });

      expect(result).toEqual({ outcome: 'not_found' });
    });

    test('an expired pending check-in cannot be confirmed', async ({ realDb }) => {
      const { port, seedBusiness, seedExpiredPendingCheckin } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pendingCheckinId = await seedExpiredPendingCheckin({ businessId: business.id, phone: '+15551230004' });

      const result = await port.confirmCheckin({ pendingCheckinId, confirmedBy: business.confirmedBy });

      expect(result).toEqual({ outcome: 'not_found' });
    });

    test('findBusinessBySlug returns null for an unknown slug', async ({ realDb }) => {
      const { port } = await createSetup({ realDb } as Fixtures);

      expect(await port.findBusinessBySlug(`nope-${crypto.randomUUID()}`)).toBeNull();
    });

    test('findBusinessBySlug finds a seeded business', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const slug = `contract-${crypto.randomUUID()}`;
      const business = await seedBusiness({ slug, rewardThreshold: 7 });

      expect(await port.findBusinessBySlug(slug)).toEqual({
        id: business.id,
        name: business.name,
        rewardThreshold: 7,
        rewardDescription: business.rewardDescription,
        logoUrl: null,
      });
    });

    test('findBusinessBySlug round-trips a business logo URL', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const slug = `contract-${crypto.randomUUID()}`;
      const logoUrl = 'https://example.supabase.co/storage/v1/object/public/business-logos/u/logo.png';
      await seedBusiness({ slug, rewardThreshold: 7, logoUrl });

      expect(await port.findBusinessBySlug(slug)).toMatchObject({ logoUrl });
    });

    test('redeems exactly at the threshold, applying rollover', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const customerId = await checkInNTimes(port, business, '+15551230005', 12);

      const result = await port.redeem({ customerId, confirmedBy: business.confirmedBy });

      expect(result).toMatchObject({ outcome: 'redeemed', customer: { points: 2 } });
    });

    test('returns not_eligible below the threshold', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const customerId = await checkInNTimes(port, business, '+15551230006', 5);

      const result = await port.redeem({ customerId, confirmedBy: business.confirmedBy });

      expect(result).toEqual({ outcome: 'not_eligible' });
    });

    test('a second redeem of the same balance fails (the fraud gate)', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const customerId = await checkInNTimes(port, business, '+15551230007', 10);

      const first = await port.redeem({ customerId, confirmedBy: business.confirmedBy });
      const second = await port.redeem({ customerId, confirmedBy: business.confirmedBy });

      expect(first.outcome).toBe('redeemed');
      expect(second).toEqual({ outcome: 'not_eligible' });
    });

    test('lists unexpired pending check-ins oldest first', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });

      const first = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230008' });
      const second = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230009' });

      const queue = await port.listPendingCheckins(business.id);

      expect(queue.map((q) => q.id)).toEqual([first.id, second.id]);
    });

    test('a repeat check-in resets the queued wait, not counts from the first visit', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const phone = '+15551230099';

      await port.createPendingCheckin({ businessId: business.id, phone });
      const staleWait = (await port.listPendingCheckins(business.id))[0]!.createdAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      const beforeSecond = Date.now();
      await port.createPendingCheckin({ businessId: business.id, phone });
      const freshWait = (await port.listPendingCheckins(business.id))[0]!.createdAt;

      expect(freshWait.getTime()).toBeGreaterThan(staleWait.getTime());
      expect(freshWait.getTime()).toBeGreaterThanOrEqual(beforeSecond - 2000);
      expect(freshWait.getTime()).toBeLessThanOrEqual(Date.now() + 2000);
    });

    test('excludes an expired pending check-in from the queue', async ({ realDb }) => {
      const { port, seedBusiness, seedExpiredPendingCheckin } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      await seedExpiredPendingCheckin({ businessId: business.id, phone: '+15551230010' });

      const queue = await port.listPendingCheckins(business.id);

      expect(queue).toEqual([]);
    });

    test('excludes a confirmed pending check-in from the queue', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230011' });
      await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });

      const queue = await port.listPendingCheckins(business.id);

      expect(queue).toEqual([]);
    });

    test('excludes pending check-ins belonging to a different business', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const businessA = await seedBusiness({ slug: `contract-a-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const businessB = await seedBusiness({ slug: `contract-b-${crypto.randomUUID()}`, rewardThreshold: 10 });
      await port.createPendingCheckin({ businessId: businessB.id, phone: '+15551230012' });

      const queue = await port.listPendingCheckins(businessA.id);

      expect(queue).toEqual([]);
    });

    test('getCheckinStatus reports pending before confirmation', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230013' });

      const status = await port.getCheckinStatus(pending.id);

      expect(status).toEqual({ status: 'pending', expiresAt: pending.expiresAt });
    });

    test('getCheckinStatus reports confirmed with the resulting customer, after confirmation', async ({
      realDb,
    }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230014' });
      await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });

      const status = await port.getCheckinStatus(pending.id);

      expect(status).toMatchObject({ status: 'confirmed', customer: { points: 1 } });
      // Public and unauthenticated — the raw phone must never round-trip
      // back out, even though it's "the customer's own data."
      if (status.status === 'confirmed') {
        expect(status.customer).not.toHaveProperty('phone');
      }
    });

    test('getCheckinStatus stops reporting a confirmed check-in once past the visibility window', async ({
      realDb,
    }) => {
      const { port, seedBusiness, seedStaleConfirmedPendingCheckin } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pendingCheckinId = await seedStaleConfirmedPendingCheckin({
        businessId: business.id,
        phone: '+15551230018',
      });

      const status = await port.getCheckinStatus(pendingCheckinId);

      // Same collapse as expired/never-existed: rows are never deleted, so
      // without this an id would be a permanent, unauthenticated read of
      // the customer's current points balance.
      expect(status).toEqual({ status: 'not_found' });
    });

    test('getCheckinStatus reports expired for a stale, unconfirmed pending check-in', async ({ realDb }) => {
      const { port, seedBusiness, seedExpiredPendingCheckin } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pendingCheckinId = await seedExpiredPendingCheckin({ businessId: business.id, phone: '+15551230015' });

      const status = await port.getCheckinStatus(pendingCheckinId);

      expect(status).toEqual({ status: 'expired' });
    });

    test('getCheckinStatus reports not_found for an unknown id', async ({ realDb }) => {
      const { port } = await createSetup({ realDb } as Fixtures);

      const status = await port.getCheckinStatus(crypto.randomUUID());

      expect(status).toEqual({ status: 'not_found' });
    });

    test('findPendingCheckinBusinessId resolves the owning business', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const pending = await port.createPendingCheckin({ businessId: business.id, phone: '+15551230016' });

      expect(await port.findPendingCheckinBusinessId(pending.id)).toBe(business.id);
    });

    test('findPendingCheckinBusinessId returns null for an unknown id', async ({ realDb }) => {
      const { port } = await createSetup({ realDb } as Fixtures);

      expect(await port.findPendingCheckinBusinessId(crypto.randomUUID())).toBeNull();
    });

    test('findCustomerBusinessId resolves the owning business', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const customerId = await checkInNTimes(port, business, '+15551230017', 1);

      expect(await port.findCustomerBusinessId(customerId)).toBe(business.id);
    });

    test('findCustomerBusinessId returns null for an unknown id', async ({ realDb }) => {
      const { port } = await createSetup({ realDb } as Fixtures);

      expect(await port.findCustomerBusinessId(crypto.randomUUID())).toBeNull();
    });

    test('hasConsented is false before any consent is recorded', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });

      expect(await port.hasConsented({ businessId: business.id, phone: '+15551230019' })).toBe(false);
    });

    test('recordConsent makes hasConsented true', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });

      await port.recordConsent({
        businessId: business.id,
        phone: '+15551230020',
        language: 'Test consent language',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(await port.hasConsented({ businessId: business.id, phone: '+15551230020' })).toBe(true);
    });

    test('hasConsented is scoped per business', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const businessA = await seedBusiness({ slug: `contract-a-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const businessB = await seedBusiness({ slug: `contract-b-${crypto.randomUUID()}`, rewardThreshold: 10 });

      await port.recordConsent({
        businessId: businessA.id,
        phone: '+15551230021',
        language: 'Test consent language',
        ip: null,
        userAgent: null,
      });

      expect(await port.hasConsented({ businessId: businessB.id, phone: '+15551230021' })).toBe(false);
    });

    test('listCustomers paginates and reports the total across all pages', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      await checkInNTimes(port, business, '+15551230022', 1);
      await checkInNTimes(port, business, '+15551230023', 1);
      await checkInNTimes(port, business, '+15551230024', 1);

      const page1 = await port.listCustomers({ businessId: business.id, page: 1, pageSize: 2, sort: 'joined', dir: 'asc' });
      const page2 = await port.listCustomers({ businessId: business.id, page: 2, pageSize: 2, sort: 'joined', dir: 'asc' });

      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(1);
      expect(page1.total).toBe(3);
      expect(page2.total).toBe(3);
    });

    test('listCustomers sorts by joined date, in either direction', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const firstId = await checkInNTimes(port, business, '+15551230025', 1);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const secondId = await checkInNTimes(port, business, '+15551230026', 1);

      const asc = await port.listCustomers({ businessId: business.id, page: 1, pageSize: 10, sort: 'joined', dir: 'asc' });
      const desc = await port.listCustomers({ businessId: business.id, page: 1, pageSize: 10, sort: 'joined', dir: 'desc' });

      expect(asc.items.map((c) => c.id)).toEqual([firstId, secondId]);
      expect(desc.items.map((c) => c.id)).toEqual([secondId, firstId]);
    });

    test('listCustomers sorts by points', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const lowId = await checkInNTimes(port, business, '+15551230027', 1);
      const highId = await checkInNTimes(port, business, '+15551230028', 3);

      const asc = await port.listCustomers({ businessId: business.id, page: 1, pageSize: 10, sort: 'points', dir: 'asc' });

      expect(asc.items.map((c) => c.id)).toEqual([lowId, highId]);
    });

    test('listCustomers is scoped per business', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const businessA = await seedBusiness({ slug: `contract-a-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const businessB = await seedBusiness({ slug: `contract-b-${crypto.randomUUID()}`, rewardThreshold: 10 });
      await checkInNTimes(port, businessA, '+15551230029', 1);
      await checkInNTimes(port, businessB, '+15551230030', 1);

      const result = await port.listCustomers({ businessId: businessA.id, page: 1, pageSize: 10, sort: 'joined', dir: 'asc' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    test('listCustomers reports sms consent per customer', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      await port.recordConsent({
        businessId: business.id,
        phone: '+15551230031',
        language: 'Test consent language',
        ip: null,
        userAgent: null,
      });
      await checkInNTimes(port, business, '+15551230031', 1);
      await checkInNTimes(port, business, '+15551230032', 1);

      const result = await port.listCustomers({ businessId: business.id, page: 1, pageSize: 10, sort: 'joined', dir: 'asc' });

      const consented = result.items.find((c) => c.phone === '+15551230031');
      const notConsented = result.items.find((c) => c.phone === '+15551230032');
      expect(consented?.hasSmsConsent).toBe(true);
      expect(notConsented?.hasSmsConsent).toBe(false);
    });

    test('listCustomers reports lifetime points and rewards given per customer', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 3 });
      // 7 confirmed visits then 2 redemptions: 7 points ever earned, 2 rewards
      // given, 1 point still unspent (7 - 3 - 3).
      const customerId = await checkInNTimes(port, business, '+15551230050', 7);
      await port.redeem({ customerId, confirmedBy: business.confirmedBy });
      await port.redeem({ customerId, confirmedBy: business.confirmedBy });

      const result = await port.listCustomers({ businessId: business.id, page: 1, pageSize: 10, sort: 'joined', dir: 'asc' });

      expect(result.items[0]).toMatchObject({ points: 1, lifetimePoints: 7, rewardsGiven: 2 });
    });

    test('listAllCustomers returns every customer, unpaginated, scoped per business', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const businessA = await seedBusiness({ slug: `contract-a-${crypto.randomUUID()}`, rewardThreshold: 10 });
      const businessB = await seedBusiness({ slug: `contract-b-${crypto.randomUUID()}`, rewardThreshold: 10 });
      await checkInNTimes(port, businessA, '+15551230033', 1);
      await checkInNTimes(port, businessA, '+15551230034', 1);
      await checkInNTimes(port, businessB, '+15551230035', 1);

      const all = await port.listAllCustomers(businessA.id);

      expect(all).toHaveLength(2);
      expect(all.map((c) => c.phone).sort()).toEqual(['+15551230033', '+15551230034']);
    });

    test('listAllCustomers reports sms consent per customer', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 10 });
      await port.recordConsent({
        businessId: business.id,
        phone: '+15551230036',
        language: 'Test consent language',
        ip: null,
        userAgent: null,
      });
      await checkInNTimes(port, business, '+15551230036', 1);

      const all = await port.listAllCustomers(business.id);

      expect(all[0]?.hasSmsConsent).toBe(true);
    });

    test('listAllCustomers reports lifetime points and rewards given per customer', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 3 });
      const customerId = await checkInNTimes(port, business, '+15551230051', 4);
      await port.redeem({ customerId, confirmedBy: business.confirmedBy });

      const all = await port.listAllCustomers(business.id);

      expect(all[0]).toMatchObject({ lifetimePoints: 4, rewardsGiven: 1 });
    });

    test('getBusinessStats counts check-ins, new customers, and rewards since the cutoff', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 1 });

      // Two customers; the first checks in twice (so 3 check-ins, 2 new
      // customers) and redeems once.
      const firstId = await checkInNTimes(port, business, '+15551230040', 2);
      await checkInNTimes(port, business, '+15551230041', 1);
      await port.redeem({ customerId: firstId, confirmedBy: business.confirmedBy });

      const stats = await port.getBusinessStats({ businessId: business.id, since: new Date(Date.now() - 60_000) });

      expect(stats).toEqual({ checkins: 3, newCustomers: 2, rewards: 1 });
    });

    test('getBusinessStats excludes everything before the cutoff', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness({ slug: `contract-${crypto.randomUUID()}`, rewardThreshold: 1 });
      const id = await checkInNTimes(port, business, '+15551230042', 1);
      await port.redeem({ customerId: id, confirmedBy: business.confirmedBy });

      const stats = await port.getBusinessStats({ businessId: business.id, since: new Date(Date.now() + 60_000) });

      expect(stats).toEqual({ checkins: 0, newCustomers: 0, rewards: 0 });
    });

    test('getBusinessStats is scoped to one business', async ({ realDb }) => {
      const { port, seedBusiness } = await createSetup({ realDb } as Fixtures);
      const businessA = await seedBusiness({ slug: `contract-a-${crypto.randomUUID()}`, rewardThreshold: 1 });
      const businessB = await seedBusiness({ slug: `contract-b-${crypto.randomUUID()}`, rewardThreshold: 1 });
      const id = await checkInNTimes(port, businessB, '+15551230043', 1);
      await port.redeem({ customerId: id, confirmedBy: businessB.confirmedBy });

      const stats = await port.getBusinessStats({ businessId: businessA.id, since: new Date(Date.now() - 60_000) });

      expect(stats).toEqual({ checkins: 0, newCustomers: 0, rewards: 0 });
    });
  });
}

async function checkInNTimes(
  port: CheckInPort,
  business: { id: string; confirmedBy: string },
  phone: string,
  n: number,
): Promise<string> {
  let customerId = '';
  for (let i = 0; i < n; i++) {
    const pending = await port.createPendingCheckin({ businessId: business.id, phone });
    const result = await port.confirmCheckin({ pendingCheckinId: pending.id, confirmedBy: business.confirmedBy });
    if (result.outcome === 'confirmed') {
      customerId = result.customer.id;
    }
  }
  return customerId;
}
