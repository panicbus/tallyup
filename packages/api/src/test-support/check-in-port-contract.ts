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

      expect(await port.findBusinessBySlug(slug)).toEqual({ id: business.id, rewardThreshold: 7 });
    });
  });
}
