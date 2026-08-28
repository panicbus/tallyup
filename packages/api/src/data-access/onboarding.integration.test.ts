import { randomUUID } from 'node:crypto';
import { describe, expect, test } from '../test-support/integration-test.js';
import { createBusinessWithOwner } from './onboarding.js';

describe('createBusinessWithOwner', () => {
  test('creates the business and an owner staff row linked to the auth account', async ({ realDb }) => {
    const authUserId = randomUUID();
    const slug = `new-shop-${randomUUID()}`;

    const result = await createBusinessWithOwner(realDb, {
      name: 'New Shop',
      slug,
      rewardThreshold: 8,
      rewardDescription: 'Free coffee',
      authUserId,
      email: 'owner@example.com',
    });

    expect(result).toMatchObject({
      outcome: 'created',
      business: { name: 'New Shop', slug, rewardThreshold: 8, rewardDescription: 'Free coffee' },
    });

    const staffRow = await realDb
      .selectFrom('staff')
      .selectAll()
      .where('auth_user_id', '=', authUserId)
      .executeTakeFirstOrThrow();
    expect(staffRow.role).toBe('owner');
    expect(staffRow.email).toBe('owner@example.com');
    if (result.outcome === 'created') {
      expect(staffRow.business_id).toBe(result.business.id);
    }
  });

  test('returns slug_taken when the slug is already in use', async ({ realDb }) => {
    const slug = `taken-shop-${randomUUID()}`;
    await createBusinessWithOwner(realDb, {
      name: 'First Shop',
      slug,
      rewardThreshold: 10,
      rewardDescription: 'Free item',
      authUserId: randomUUID(),
      email: 'first@example.com',
    });

    const result = await createBusinessWithOwner(realDb, {
      name: 'Second Shop',
      slug,
      rewardThreshold: 10,
      rewardDescription: 'Free item',
      authUserId: randomUUID(),
      email: 'second@example.com',
    });

    expect(result).toEqual({ outcome: 'slug_taken' });
  });

  test('returns already_onboarded when the auth account already owns a business', async ({ realDb }) => {
    const authUserId = randomUUID();
    await createBusinessWithOwner(realDb, {
      name: 'First Shop',
      slug: `first-shop-${randomUUID()}`,
      rewardThreshold: 10,
      rewardDescription: 'Free item',
      authUserId,
      email: 'owner@example.com',
    });

    const result = await createBusinessWithOwner(realDb, {
      name: 'Second Shop',
      slug: `second-shop-${randomUUID()}`,
      rewardThreshold: 10,
      rewardDescription: 'Free item',
      authUserId,
      email: 'owner@example.com',
    });

    expect(result).toEqual({ outcome: 'already_onboarded' });
  });
});
