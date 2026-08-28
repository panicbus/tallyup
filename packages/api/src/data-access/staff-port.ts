import type { Kysely } from 'kysely';
import { findStaffByAuthUserId, type StaffContext } from './staff.js';
import type { Database } from './types.js';

export type { StaffContext };

/** Swappable so route tests can resolve staff identity without a real
 * Postgres connection — mirrors CheckInPort's fake/real split. */
export interface StaffPort {
  findByAuthUserId(authUserId: string): Promise<StaffContext | null>;
}

export function createKyselyStaffPort(db: Kysely<Database>): StaffPort {
  return {
    findByAuthUserId: (authUserId) => findStaffByAuthUserId(db, authUserId),
  };
}
