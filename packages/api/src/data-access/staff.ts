import type { Kysely } from 'kysely';
import type { Database } from './types.js';

export interface StaffMember {
  id: string;
  email: string;
  role: string;
}

/**
 * Plain read, no port/fake needed — no branching logic to test in
 * isolation, unlike the check-in loop's transactional operations.
 */
export async function listStaffByBusiness(db: Kysely<Database>, businessId: string): Promise<StaffMember[]> {
  return db
    .selectFrom('staff')
    .select(['id', 'email', 'role'])
    .where('business_id', '=', businessId)
    .orderBy('email', 'asc')
    .execute();
}
