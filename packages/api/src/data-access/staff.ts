import type { Kysely } from 'kysely';
import type { Database } from './types.js';

export interface StaffContext {
  id: string;
  email: string;
  role: string;
  business: {
    id: string;
    name: string;
    slug: string;
    rewardThreshold: number;
    rewardDescription: string;
  };
}

/**
 * Plain read, no port/fake needed — no branching logic to test in
 * isolation, unlike the check-in loop's transactional operations. The join
 * is here (not two round trips) because every caller of this needs both
 * halves: it's how a verified token becomes "this staff member, at this
 * business" for route-level authorization.
 */
export async function findStaffByAuthUserId(db: Kysely<Database>, authUserId: string): Promise<StaffContext | null> {
  if (authUserId === null) return null;

  const row = await db
    .selectFrom('staff')
    .innerJoin('businesses', 'businesses.id', 'staff.business_id')
    .select([
      'staff.id as id',
      'staff.email as email',
      'staff.role as role',
      'businesses.id as businessId',
      'businesses.name as businessName',
      'businesses.slug as businessSlug',
      'businesses.reward_threshold as rewardThreshold',
      'businesses.reward_description as rewardDescription',
    ])
    .where('staff.auth_user_id', '=', authUserId)
    .executeTakeFirst();

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    business: {
      id: row.businessId,
      name: row.businessName,
      slug: row.businessSlug,
      rewardThreshold: row.rewardThreshold,
      rewardDescription: row.rewardDescription,
    },
  };
}
