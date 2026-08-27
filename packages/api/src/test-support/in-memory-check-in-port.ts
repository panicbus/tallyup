import { randomUUID } from 'node:crypto';
import type { Business, CheckInPort } from '../data-access/check-in-port.js';

const PENDING_CHECKIN_TTL_MS = 20 * 60_000;

interface StoredBusiness extends Business {
  slug: string;
}

interface StoredPendingCheckin {
  id: string;
  businessId: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
}

interface StoredCustomer {
  id: string;
  businessId: string;
  phone: string;
  points: number;
}

/**
 * In-memory double for CheckInPort, used by service-layer unit tests (S2).
 * Bundled with seed helpers (beyond the CheckInPort interface itself) so
 * shared contract tests can set up fixtures identically across this fake
 * and the real Kysely adapter — see check-in-port-contract.ts.
 */
export function createInMemoryCheckInPort() {
  const businesses = new Map<string, StoredBusiness>();
  const pendingCheckins = new Map<string, StoredPendingCheckin>();
  const customers = new Map<string, StoredCustomer>();

  const port: CheckInPort = {
    async findBusinessBySlug(slug) {
      for (const business of businesses.values()) {
        if (business.slug === slug) {
          return { id: business.id, rewardThreshold: business.rewardThreshold };
        }
      }
      return null;
    },

    async createPendingCheckin({ businessId, phone }) {
      const existing = [...pendingCheckins.values()].find(
        (p) => p.businessId === businessId && p.phone === phone,
      );
      const now = new Date();
      const expiresAt = new Date(now.getTime() + PENDING_CHECKIN_TTL_MS);

      if (existing) {
        existing.createdAt = now;
        existing.expiresAt = expiresAt;
        return { id: existing.id, expiresAt };
      }

      const id = randomUUID();
      pendingCheckins.set(id, { id, businessId, phone, createdAt: now, expiresAt });
      return { id, expiresAt };
    },

    async confirmCheckin({ pendingCheckinId, confirmedBy }) {
      const pending = pendingCheckins.get(pendingCheckinId);
      if (!pending || pending.expiresAt.getTime() <= Date.now()) {
        return { outcome: 'not_found' };
      }
      pendingCheckins.delete(pendingCheckinId);
      void confirmedBy; // recorded on a `visits` row in the real adapter; nothing to store here

      const business = businesses.get(pending.businessId);
      if (!business) {
        throw new Error(`no business seeded for id ${pending.businessId}`);
      }

      const customerKey = `${pending.businessId}:${pending.phone}`;
      const existingCustomer = customers.get(customerKey);
      const customer: StoredCustomer = existingCustomer
        ? { ...existingCustomer, points: existingCustomer.points + 1 }
        : { id: randomUUID(), businessId: pending.businessId, phone: pending.phone, points: 1 };
      customers.set(customerKey, customer);

      return {
        outcome: 'confirmed',
        customer: { id: customer.id, phone: customer.phone, points: customer.points },
        business: { id: business.id, rewardThreshold: business.rewardThreshold },
      };
    },

    async redeem({ customerId, confirmedBy }) {
      void confirmedBy; // recorded on a `redemptions` row in the real adapter; nothing to store here
      const customer = [...customers.values()].find((c) => c.id === customerId);
      if (!customer) {
        return { outcome: 'not_eligible' };
      }

      const business = businesses.get(customer.businessId);
      if (!business) {
        throw new Error(`no business seeded for id ${customer.businessId}`);
      }

      if (customer.points < business.rewardThreshold) {
        return { outcome: 'not_eligible' };
      }

      customer.points -= business.rewardThreshold;

      return {
        outcome: 'redeemed',
        customer: { id: customer.id, phone: customer.phone, points: customer.points },
        business: { id: business.id, rewardThreshold: business.rewardThreshold },
      };
    },

    async listPendingCheckins(businessId) {
      const now = Date.now();
      return [...pendingCheckins.values()]
        .filter((p) => p.businessId === businessId && p.expiresAt.getTime() > now)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((p) => ({ id: p.id, phone: p.phone, createdAt: p.createdAt }));
    },
  };

  async function seedBusiness(
    input: { slug: string; rewardThreshold: number },
  ): Promise<Business & { confirmedBy: string }> {
    const business: StoredBusiness = { id: randomUUID(), slug: input.slug, rewardThreshold: input.rewardThreshold };
    businesses.set(business.id, business);
    // The real adapter requires confirmedBy to be a staff row belonging to
    // this business (composite FK); this fake doesn't enforce that, but
    // still hands back an id here so contract tests can treat both adapters
    // identically rather than special-casing "confirmedBy" per adapter.
    return { id: business.id, rewardThreshold: business.rewardThreshold, confirmedBy: randomUUID() };
  }

  async function seedExpiredPendingCheckin(input: { businessId: string; phone: string }): Promise<string> {
    const id = randomUUID();
    pendingCheckins.set(id, {
      id,
      businessId: input.businessId,
      phone: input.phone,
      createdAt: new Date(Date.now() - PENDING_CHECKIN_TTL_MS - 1000),
      expiresAt: new Date(Date.now() - 1000),
    });
    return id;
  }

  return { port, seedBusiness, seedExpiredPendingCheckin };
}
