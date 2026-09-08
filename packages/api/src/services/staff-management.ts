import type { PendingInviteEntry, StaffPort } from '../data-access/staff-port.js';
import type { StaffRole } from '../data-access/types.js';

export interface VisibleStaffEntry {
  id: string;
  role: StaffRole;
  deactivatedAt: Date | null;
  /** Owner-only — absent entirely for a non-owner caller, not just blanked,
   * so there's no field a client could mistakenly render as empty. */
  email?: string;
}

export interface VisibleRoster {
  staff: VisibleStaffEntry[];
  /** Owner-only — a non-owner caller must not be able to enumerate
   * outstanding invite metadata. */
  pendingInvites?: PendingInviteEntry[];
}

/**
 * Shapes the roster per caller role — the same masking convention as
 * phone numbers, applied here to email and pending-invite visibility
 * instead. All staff see who their active colleagues are; only the owner
 * sees emails, deactivated history, and pending invites.
 */
export async function getStaffRoster(
  port: Pick<StaffPort, 'listStaff'>,
  input: { businessId: string; callerRole: StaffRole },
): Promise<VisibleRoster> {
  const roster = await port.listStaff(input.businessId);

  if (input.callerRole === 'owner') {
    return roster;
  }

  return {
    staff: roster.staff
      .filter((entry) => entry.deactivatedAt === null)
      .map((entry) => ({ id: entry.id, role: entry.role, deactivatedAt: null })),
  };
}
