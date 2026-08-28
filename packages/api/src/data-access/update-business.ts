import type { Kysely } from 'kysely';
import type { OnboardedBusiness } from './onboarding.js';
import type { Database } from './types.js';

export interface UpdateBusinessInput {
  name: string;
  rewardThreshold: number;
  rewardDescription: string;
}

/** Plain write, no port/fake needed — single real consumer (the settings
 * route), same tier as createBusinessWithOwner. Slug is deliberately not a
 * parameter here: it's printed on physical signage and never editable. */
export async function updateBusiness(
  db: Kysely<Database>,
  businessId: string,
  input: UpdateBusinessInput,
): Promise<OnboardedBusiness> {
  const row = await db
    .updateTable('businesses')
    .set({
      name: input.name,
      reward_threshold: input.rewardThreshold,
      reward_description: input.rewardDescription,
    })
    .where('id', '=', businessId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    rewardThreshold: row.reward_threshold,
    rewardDescription: row.reward_description,
  };
}
