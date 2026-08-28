import type { Kysely } from 'kysely';
import type { Database } from './types.js';

export interface OnboardedBusiness {
  id: string;
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
}

export type CreateBusinessResult =
  | { outcome: 'created'; business: OnboardedBusiness }
  | { outcome: 'slug_taken' }
  | { outcome: 'already_onboarded' };

export interface CreateBusinessInput {
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
  authUserId: string;
  email: string;
}

/**
 * Creates a business and its first (owner) staff row together. Check-then-
 * insert inside one transaction — same style as confirmCheckin/redeem's
 * guarded operations — rather than catching a unique-constraint violation,
 * so the two ways this can fail (slug taken, account already onboarded)
 * read as plain branches instead of parsed Postgres error codes. No
 * port/fake: a single real consumer (the onboarding route), same tier of
 * coverage as findStaffByAuthUserId — integration-tested only.
 */
export async function createBusinessWithOwner(
  db: Kysely<Database>,
  input: CreateBusinessInput,
): Promise<CreateBusinessResult> {
  return db.transaction().execute(async (trx) => {
    const existingBusiness = await trx
      .selectFrom('businesses')
      .select('id')
      .where('slug', '=', input.slug)
      .executeTakeFirst();
    if (existingBusiness) {
      return { outcome: 'slug_taken' };
    }

    const existingStaff = await trx
      .selectFrom('staff')
      .select('id')
      .where('auth_user_id', '=', input.authUserId)
      .executeTakeFirst();
    if (existingStaff) {
      return { outcome: 'already_onboarded' };
    }

    const business = await trx
      .insertInto('businesses')
      .values({
        name: input.name,
        slug: input.slug,
        reward_threshold: input.rewardThreshold,
        reward_description: input.rewardDescription,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('staff')
      .values({ business_id: business.id, email: input.email, role: 'owner', auth_user_id: input.authUserId })
      .execute();

    return {
      outcome: 'created',
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        rewardThreshold: business.reward_threshold,
        rewardDescription: business.reward_description,
      },
    };
  });
}
