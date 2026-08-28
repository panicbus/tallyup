import { describe, expect } from 'vitest';
import type { Business, CheckInPort } from '../data-access/check-in-port.js';

export interface CheckInPortContractSetup {
  port: CheckInPort;
  seedBusiness(input: { slug: string; rewardThreshold: number }): Promise<Business & { confirmedBy: string }>;
  seedExpiredPendingCheckin(input: { businessId: string; phone: string }): Promise<string>;
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
      });
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

      expect(status).toMatchObject({ status: 'confirmed', customer: { phone: '+15551230014', points: 1 } });
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
