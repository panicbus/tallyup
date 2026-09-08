import { randomUUID } from 'node:crypto';
import type { Business, CheckInPort } from '../data-access/check-in-port.js';

const PENDING_CHECKIN_TTL_MS = 20 * 60_000;
// Mirrors kysely-check-in-port.ts's CONFIRMED_STATUS_VISIBILITY_MS — kept as
// a duplicated literal rather than a shared import, same as
// PENDING_CHECKIN_TTL_MS above; the contract suite is what keeps the two
// adapters from drifting.
const CONFIRMED_STATUS_VISIBILITY_MS = 5 * 60_000;

interface StoredBusiness extends Business {
  slug: string;
}

interface StoredPendingCheckin {
  id: string;
  businessId: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
  confirmedAt: Date | null;
}

interface StoredCustomer {
  id: string;
  businessId: string;
  phone: string;
  points: number;
  createdAt: Date;
}

interface StoredSmsConsent {
  businessId: string;
  phone: string;
  language: string;
  ip: string | null;
  userAgent: string | null;
  consentedAt: Date;
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
  // Array, not a Map: append-only, and more than one consent per
  // (businessId, phone) is expected and must never overwrite an earlier one.
  const smsConsents: StoredSmsConsent[] = [];

  function businessView(business: StoredBusiness): Business {
    return {
      id: business.id,
      name: business.name,
      rewardThreshold: business.rewardThreshold,
      rewardDescription: business.rewardDescription,
      logoUrl: business.logoUrl,
    };
  }

  const port: CheckInPort = {
    async findBusinessBySlug(slug) {
      for (const business of businesses.values()) {
        if (business.slug === slug) {
          return businessView(business);
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
        existing.confirmedAt = null; // a fresh submission always starts a new pending state
        return { id: existing.id, expiresAt };
      }

      const id = randomUUID();
      pendingCheckins.set(id, { id, businessId, phone, createdAt: now, expiresAt, confirmedAt: null });
      return { id, expiresAt };
    },

    async confirmCheckin({ pendingCheckinId, confirmedBy }) {
      const pending = pendingCheckins.get(pendingCheckinId);
      if (!pending || pending.confirmedAt !== null || pending.expiresAt.getTime() <= Date.now()) {
        return { outcome: 'not_found' };
      }
      pending.confirmedAt = new Date();
      void confirmedBy; // recorded on a `visits` row in the real adapter; nothing to store here

      const business = businesses.get(pending.businessId);
      if (!business) {
        throw new Error(`no business seeded for id ${pending.businessId}`);
      }

      const customerKey = `${pending.businessId}:${pending.phone}`;
      const existingCustomer = customers.get(customerKey);
      const customer: StoredCustomer = existingCustomer
        ? { ...existingCustomer, points: existingCustomer.points + 1 }
        : { id: randomUUID(), businessId: pending.businessId, phone: pending.phone, points: 1, createdAt: new Date() };
      customers.set(customerKey, customer);

      return {
        outcome: 'confirmed',
        customer: { id: customer.id, phone: customer.phone, points: customer.points },
        business: businessView(business),
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
        business: businessView(business),
      };
    },

    async listPendingCheckins(businessId) {
      const now = Date.now();
      return [...pendingCheckins.values()]
        .filter((p) => p.businessId === businessId && p.confirmedAt === null && p.expiresAt.getTime() > now)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((p) => ({ id: p.id, phone: p.phone, createdAt: p.createdAt }));
    },

    async getCheckinStatus(pendingCheckinId) {
      const pending = pendingCheckins.get(pendingCheckinId);
      if (!pending) {
        return { status: 'not_found' };
      }

      if (pending.confirmedAt !== null) {
        if (Date.now() - pending.confirmedAt.getTime() > CONFIRMED_STATUS_VISIBILITY_MS) {
          return { status: 'not_found' };
        }

        const business = businesses.get(pending.businessId);
        if (!business) {
          throw new Error(`no business seeded for id ${pending.businessId}`);
        }
        const customer = customers.get(`${pending.businessId}:${pending.phone}`);
        if (!customer) {
          throw new Error(`confirmed pending checkin ${pendingCheckinId} has no matching customer`);
        }
        return {
          status: 'confirmed',
          customer: { id: customer.id, points: customer.points },
          business: businessView(business),
        };
      }

      if (pending.expiresAt.getTime() <= Date.now()) {
        return { status: 'expired' };
      }

      return { status: 'pending', expiresAt: pending.expiresAt };
    },

    async findPendingCheckinBusinessId(pendingCheckinId) {
      return pendingCheckins.get(pendingCheckinId)?.businessId ?? null;
    },

    async findCustomerBusinessId(customerId) {
      for (const customer of customers.values()) {
        if (customer.id === customerId) return customer.businessId;
      }
      return null;
    },

    async recordConsent({ businessId, phone, language, ip, userAgent }) {
      smsConsents.push({ businessId, phone, language, ip, userAgent, consentedAt: new Date() });
    },

    async hasConsented({ businessId, phone }) {
      return smsConsents.some((c) => c.businessId === businessId && c.phone === phone);
    },

    async listCustomers({ businessId, page, pageSize, sort, dir }) {
      const all = [...customers.values()].filter((c) => c.businessId === businessId);
      const sign = dir === 'asc' ? 1 : -1;
      const sorted = all.sort((a, b) => {
        const diff = sort === 'points' ? a.points - b.points : a.createdAt.getTime() - b.createdAt.getTime();
        return diff * sign;
      });

      const start = (page - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize).map((c) => toRosterEntry(c, businessId));

      return { items, total: all.length, page, pageSize };
    },

    async listAllCustomers(businessId) {
      return [...customers.values()]
        .filter((c) => c.businessId === businessId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((c) => toRosterEntry(c, businessId));
    },
  };

  function toRosterEntry(customer: StoredCustomer, businessId: string) {
    return {
      id: customer.id,
      phone: customer.phone,
      points: customer.points,
      createdAt: customer.createdAt,
      hasSmsConsent: smsConsents.some((s) => s.businessId === businessId && s.phone === customer.phone),
    };
  }

  async function seedBusiness(
    input: {
      slug: string;
      rewardThreshold: number;
      name?: string;
      rewardDescription?: string;
      logoUrl?: string | null;
    },
  ): Promise<Business & { confirmedBy: string }> {
    const business: StoredBusiness = {
      id: randomUUID(),
      slug: input.slug,
      name: input.name ?? 'Test Business',
      rewardThreshold: input.rewardThreshold,
      rewardDescription: input.rewardDescription ?? 'Free item',
      logoUrl: input.logoUrl ?? null,
    };
    businesses.set(business.id, business);
    // The real adapter requires confirmedBy to be a staff row belonging to
    // this business (composite FK); this fake doesn't enforce that, but
    // still hands back an id here so contract tests can treat both adapters
    // identically rather than special-casing "confirmedBy" per adapter.
    return { ...businessView(business), confirmedBy: randomUUID() };
  }

  async function seedExpiredPendingCheckin(input: { businessId: string; phone: string }): Promise<string> {
    const id = randomUUID();
    pendingCheckins.set(id, {
      id,
      businessId: input.businessId,
      phone: input.phone,
      createdAt: new Date(Date.now() - PENDING_CHECKIN_TTL_MS - 1000),
      expiresAt: new Date(Date.now() - 1000),
      confirmedAt: null,
    });
    return id;
  }

  /** A pending check-in confirmed long enough ago that the status poll's
   * visibility window has already lapsed — for exercising the "old
   * confirmed id returns nothing sensitive" behavior identically across
   * both adapters via the shared contract suite. */
  async function seedStaleConfirmedPendingCheckin(input: { businessId: string; phone: string }): Promise<string> {
    const customerKey = `${input.businessId}:${input.phone}`;
    if (!customers.has(customerKey)) {
      customers.set(customerKey, {
        id: randomUUID(),
        businessId: input.businessId,
        phone: input.phone,
        points: 1,
        createdAt: new Date(),
      });
    }

    const id = randomUUID();
    const confirmedAt = new Date(Date.now() - CONFIRMED_STATUS_VISIBILITY_MS - 1000);
    pendingCheckins.set(id, {
      id,
      businessId: input.businessId,
      phone: input.phone,
      createdAt: confirmedAt,
      expiresAt: new Date(confirmedAt.getTime() + PENDING_CHECKIN_TTL_MS),
      confirmedAt,
    });
    return id;
  }

  return { port, seedBusiness, seedExpiredPendingCheckin, seedStaleConfirmedPendingCheckin };
}
