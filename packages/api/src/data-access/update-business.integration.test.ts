import { randomUUID } from 'node:crypto';
import { describe, expect, test } from '../test-support/integration-test.js';
import { updateBusiness } from './update-business.js';

describe('updateBusiness', () => {
  test('updates name, reward threshold, and reward description, leaving the slug untouched', async ({ db }) => {
    const slug = `update-me-${randomUUID()}`;
    const business = await db
      .insertInto('businesses')
      .values({ name: 'Old Name', slug, reward_threshold: 10, reward_description: 'Old reward' })
      .returningAll()
      .executeTakeFirstOrThrow();

    const result = await updateBusiness(db, business.id, {
      name: 'New Name',
      rewardThreshold: 5,
      rewardDescription: 'New reward',
    });

    expect(result).toEqual({
      id: business.id,
      name: 'New Name',
      slug,
      rewardThreshold: 5,
      rewardDescription: 'New reward',
      logoUrl: null,
    });
  });

  test('leaves an existing logo alone when logoUrl is omitted', async ({ db }) => {
    const logoUrl = 'https://test-project.supabase.co/storage/v1/object/public/business-logos/u/keep.png';
    const business = await db
      .insertInto('businesses')
      .values({
        name: 'Old Name',
        slug: `keep-logo-${randomUUID()}`,
        reward_threshold: 10,
        reward_description: 'Old reward',
        logo_url: logoUrl,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const result = await updateBusiness(db, business.id, {
      name: 'New Name',
      rewardThreshold: 5,
      rewardDescription: 'New reward',
    });

    expect(result.logoUrl).toBe(logoUrl);
  });

  test('clears the logo when logoUrl is explicitly null', async ({ db }) => {
    const business = await db
      .insertInto('businesses')
      .values({
        name: 'Old Name',
        slug: `clear-logo-${randomUUID()}`,
        reward_threshold: 10,
        reward_description: 'Old reward',
        logo_url: 'https://test-project.supabase.co/storage/v1/object/public/business-logos/u/old.png',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const result = await updateBusiness(db, business.id, {
      name: 'New Name',
      rewardThreshold: 5,
      rewardDescription: 'New reward',
      logoUrl: null,
    });

    expect(result.logoUrl).toBeNull();
  });
});
