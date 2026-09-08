import type { StaffContext } from './staff.js';
import type { StaffRole } from './types.js';

export type { StaffContext };

export interface CreatedInvite {
  id: string;
  /** Plaintext, returned exactly once — only the hash is ever persisted. */
  code: string;
  expiresAt: Date;
}

export type RedeemInviteResult =
  | { outcome: 'redeemed'; businessId: string; role: StaffRole }
  | { outcome: 'invalid_code' }
  | { outcome: 'already_staff' };

export type RevokeInviteResult = { outcome: 'revoked' } | { outcome: 'not_found' };

export interface StaffListEntry {
  id: string;
  email: string;
  role: StaffRole;
  deactivatedAt: Date | null;
}

export interface PendingInviteEntry {
  id: string;
  role: StaffRole;
  createdAt: Date;
  expiresAt: Date;
}

export interface StaffRoster {
  staff: StaffListEntry[];
  pendingInvites: PendingInviteEntry[];
}

export type DeactivateStaffResult =
  | { outcome: 'deactivated' }
  | { outcome: 'not_found' }
  | { outcome: 'last_owner' };

/**
 * Swappable so route tests can resolve staff identity and manage the
 * roster without a real Postgres connection — mirrors CheckInPort's
 * fake/real split. Bundles identity lookup, the invite lifecycle, and
 * deactivation together: all three operate on the same staff/staff_invites
 * tables and are the "staff management" domain as a whole, the same reason
 * CheckInPort bundles the check-in loop's several coarse operations.
 */
export interface StaffPort {
  findByAuthUserId(authUserId: string): Promise<StaffContext | null>;
  /** Tenant-isolation lookup, same shape as CheckInPort's
   * findCustomerBusinessId — which business a staff row belongs to, so a
   * route can 403 before acting on someone outside the caller's business.
   * Null if the staff row doesn't exist at all (404, not 403). */
  findStaffBusinessId(staffId: string): Promise<string | null>;
  createInvite(input: { businessId: string; role: StaffRole; createdBy: string }): Promise<CreatedInvite>;
  /**
   * Redeems a bearer invite code for an already-authenticated identity. One
   * guarded transaction: rejects an identity that already has an active
   * staff row anywhere, consumes the code exactly once (a concurrent second
   * redemption of the same code always loses), and either reactivates a
   * matching deactivated row at the invite's business or creates a fresh
   * one — never both, never neither.
   */
  redeemInvite(input: { code: string; authUserId: string; email: string }): Promise<RedeemInviteResult>;
  /**
   * Nullifies a still-pending invite so its code can never be redeemed.
   * Scoped to `businessId` for tenant isolation — an invite id belonging to
   * another business is `not_found`, never touched — and only acts on an
   * invite that is still live (not already redeemed, revoked, or expired).
   */
  revokeInvite(input: { inviteId: string; businessId: string }): Promise<RevokeInviteResult>;
  /** The full roster for one business: active/deactivated staff and
   * still-valid pending invites. Redacting this for non-owner callers (no
   * email, no pending invites) is a services/ concern, applied before this
   * ever reaches a route — same convention as phone masking. */
  listStaff(businessId: string): Promise<StaffRoster>;
  /**
   * Soft-deletes a staff member — never a hard delete, since
   * visits/redemptions.confirmed_by have no ON DELETE. Guarded: refuses to
   * deactivate the last active owner of a business, using `for update`
   * locking so two concurrent deactivations of different owners can't both
   * succeed and leave a business with none.
   */
  deactivateStaff(input: { staffId: string; deactivatedBy: string }): Promise<DeactivateStaffResult>;
}
