import type { Kysely, UpdateObject } from 'kysely';
import type { OnboardedBusiness } from './onboarding.js';
import type { Database } from './types.js';

export interface UpdateBusinessInput {
  name: string;
  rewardThreshold: number;
  rewardDescription: string;
  /** Three-state, deliberately: omitted leaves the existing logo alone,
   * an explicit null clears it, a string replaces it. The route has
   * already checked any string belongs to the caller's own storage
   * folder — see services/logo-url.ts. */
  logoUrl?: string | null;
}

/** Plain write, no port/fake needed — single real consumer (the settings
 * route), same tier as createBusinessWithOwner. Slug is deliberately not a
 * parameter here: it's printed on physical signage and never editable. */
export async function updateBusiness(
  db: Kysely<Database>,
  businessId: string,
  input: UpdateBusinessInput,
): Promise<OnboardedBusiness> {
  const values: UpdateObject<Database, 'businesses'> = {
    name: input.name,
    reward_threshold: input.rewardThreshold,
    reward_description: input.rewardDescription,
  };

  // Built conditionally rather than passing `logo_url: undefined` — Kysely
  // would emit that as an actual `set logo_url = null`, silently wiping a
  // logo on every settings save that didn't happen to mention one.
  if (input.logoUrl !== undefined) {
    values.logo_url = input.logoUrl;
  }

  const row = await db
    .updateTable('businesses')
    .set(values)
    .where('id', '=', businessId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    rewardThreshold: row.reward_threshold,
    rewardDescription: row.reward_description,
    logoUrl: row.logo_url,
  };
}
