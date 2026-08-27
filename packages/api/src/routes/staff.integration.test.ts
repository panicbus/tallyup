import type { Kysely } from 'kysely';
import { describe, expect, test } from '../test-support/integration-test.js';
import { buildApp } from '../app.js';
import { createKyselyCheckInPort } from '../data-access/kysely-check-in-port.js';
import type { Database } from '../data-access/types.js';

async function seedBusinessWithStaff(db: Kysely<Database>, emails: string[]) {
  const business = await db
    .insertInto('businesses')
    .values({
      name: 'Staff Route Test Shop',
      slug: `staff-route-${crypto.randomUUID()}`,
      reward_threshold: 10,
      reward_description: 'Free item',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  for (const email of emails) {
    await db.insertInto('staff').values({ business_id: business.id, email, role: 'owner' }).execute();
  }

  return business;
}

describe('GET /businesses/:slug/staff', () => {
  test('lists staff for the business', async ({ realDb }) => {
    const business = await seedBusinessWithStaff(realDb, ['anna@example.com']);
    const app = buildApp({ checkInPort: createKyselyCheckInPort(realDb), db: realDb }, { logger: false });

    const response = await app.inject({ method: 'GET', url: `/businesses/${business.slug}/staff` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([{ email: 'anna@example.com', role: 'owner' }]);
  });

  test('404s for an unknown business slug', async ({ realDb }) => {
    const app = buildApp({ checkInPort: createKyselyCheckInPort(realDb), db: realDb }, { logger: false });

    const response = await app.inject({ method: 'GET', url: '/businesses/no-such-shop/staff' });

    expect(response.statusCode).toBe(404);
  });
});
