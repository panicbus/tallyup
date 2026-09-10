import type { StaffContext } from './staff.js';
import type { StaffRole } from './types.js';

export type { StaffContext };

export interface CreatedInvite {
  id: string;
  /** Plaintext, returned exactly once — only the hash is ever persisted.
   * The route never forwards this to the client; it exists so the send
   * service can build the join link. */
  code: string;
  expiresAt: Date;
}

/** What the join page shows before anyone commits to redeeming — a
 * non-consuming read of a live invite. Null (not an outcome) for unknown,
 * expired, revoked, or already-redeemed, mirroring AuthPort.verifyToken:
 * the page never needs to know which. */
export interface InviteDescription {
  businessName: string;
  businessSlug: string;
  /** Email of the staff member who sent the invite. */
  invitedBy: string;
  role: StaffRole;
  /** The address the invite was sent to, normalized. The join page locks
   * its signup field to this. */
  email: string;
  expiresAt: Date;
}

export type RedeemInviteResult =
  | { outcome: 'redeemed'; businessId: string; role: StaffRole }
  | { outcome: 'invalid_code' }
  // The signed-in account's email does not match the invited address. The
  // invite is left untouched, so a forwarded link still works for its real
  // recipient.
  | { outcome: 'wrong_account' }
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
  /** The address the invite was emailed to, normalized. */
  email: string;
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
  /**
   * Mints an invite for one specific email address. The address is stored
   * normalized and is what authorizes redemption later. Supersedes any
   * still-live invite to the same address at the same business: only the
   * hash is kept, so re-inviting is the only "resend", and a stale link
   * must stop working the moment a fresh one is issued.
   */
  createInvite(input: { businessId: string; email: string; role: StaffRole; createdBy: string }): Promise<CreatedInvite>;
  /** A non-consuming read of a live invite, for the join page's confirmation
   * card. Null for unknown, expired, revoked, or already-redeemed. */
  describeInvite(code: string): Promise<InviteDescription | null>;
  /**
   * Redeems a bearer invite code for an already-authenticated identity. One
   * guarded transaction, checks in a fixed order so a doomed attempt never
   * burns the code: (1) the invite must be live, else `invalid_code`;
   * (2) the identity's email must match the invited address, else
   * `wrong_account`, nothing consumed; (3) the identity must not already be
   * active staff anywhere, else `already_staff`, nothing consumed; then it
   * consumes the code exactly once (a concurrent second redemption always
   * loses) and either reactivates a matching deactivated row at the
   * invite's business or creates a fresh one — never both, never neither.
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
