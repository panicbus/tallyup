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
    });
  });
});
