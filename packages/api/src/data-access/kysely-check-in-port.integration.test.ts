import type { Kysely } from 'kysely';
import { test } from '../test-support/integration-test.js';
import { runCheckInPortContractTests } from '../test-support/check-in-port-contract.js';
import { createKyselyCheckInPort } from './kysely-check-in-port.js';
import type { Database } from './types.js';

async function seedBusiness(
  db: Kysely<Database>,
  input: { slug: string; rewardThreshold: number; logoUrl?: string | null },
) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Contract Test Shop',
      slug: input.slug,
      reward_threshold: input.rewardThreshold,
      reward_description: 'Free item',
      logo_url: input.logoUrl ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const staff = await db
    .insertInto('staff')
    .values({ business_id: business.id, email: `staff-${crypto.randomUUID()}@example.com`, role: 'owner' })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: business.id,
    name: business.name,
    rewardThreshold: business.reward_threshold,
    rewardDescription: business.reward_description,
    logoUrl: business.logo_url,
    confirmedBy: staff.id,
  };
}

async function seedExpiredPendingCheckin(db: Kysely<Database>, input: { businessId: string; phone: string }) {
  const row = await db
    .insertInto('pending_checkins')
    .values({ business_id: input.businessId, phone: input.phone, expires_at: new Date(Date.now() - 1000) })
    .returning('id')
    .executeTakeFirstOrThrow();

  return row.id;
}

// Matches kysely-check-in-port.ts's CONFIRMED_STATUS_VISIBILITY_MS.
const CONFIRMED_STATUS_VISIBILITY_MS = 5 * 60_000;

async function seedStaleConfirmedPendingCheckin(
  db: Kysely<Database>,
  input: { businessId: string; phone: string },
) {
  await db
    .insertInto('customers')
    .values({ business_id: input.businessId, phone: input.phone, points: 1 })
    .onConflict((oc) => oc.columns(['business_id', 'phone']).doNothing())
    .execute();

  const confirmedAt = new Date(Date.now() - CONFIRMED_STATUS_VISIBILITY_MS - 1000);
  const row = await db
    .insertInto('pending_checkins')
    .values({
      business_id: input.businessId,
      phone: input.phone,
      expires_at: new Date(confirmedAt.getTime() + 20 * 60_000),
      confirmed_at: confirmedAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return row.id;
}

runCheckInPortContractTests(test, async ({ realDb }: { realDb: Kysely<Database> }) => ({
  port: createKyselyCheckInPort(realDb),
  seedBusiness: (input) => seedBusiness(realDb, input),
  seedExpiredPendingCheckin: (input) => seedExpiredPendingCheckin(realDb, input),
  seedStaleConfirmedPendingCheckin: (input) => seedStaleConfirmedPendingCheckin(realDb, input),
}));
