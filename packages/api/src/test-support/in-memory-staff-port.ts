import { randomUUID } from 'node:crypto';
import type { StaffContext, StaffPort } from '../data-access/staff-port.js';
import type { StaffRole } from '../data-access/types.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

interface StoredStaff {
  id: string;
  businessId: string;
  email: string;
  role: StaffRole;
  authUserId: string;
  deactivatedAt: Date | null;
  deactivatedBy: string | null;
  business: StaffContext['business'];
}

interface StoredInvite {
  id: string;
  businessId: string;
  // Plaintext, not a hash — this fake mirrors the real adapter's observable
  // behavior (single-use, expiry, role/business returned), not its
  // mechanism. Same principle as PENDING_CHECKIN_TTL_MS being duplicated
  // rather than shared: the contract suite is what keeps them from drifting.
  code: string;
  role: StaffRole;
  createdAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedBy: string | null;
}

export function createInMemoryStaffPort() {
  const staffById = new Map<string, StoredStaff>();
  const invites = new Map<string, StoredInvite>();

  function toStaffContext(staff: StoredStaff): StaffContext {
    return { id: staff.id, email: staff.email, role: staff.role, business: staff.business };
  }

  function placeholderBusiness(businessId: string): StaffContext['business'] {
    return {
      id: businessId,
      name: 'Test Business',
      slug: `test-business-${randomUUID()}`,
      rewardThreshold: 10,
      rewardDescription: 'Free item',
      logoUrl: null,
    };
  }

  const port: StaffPort = {
    async findByAuthUserId(authUserId: string): Promise<StaffContext | null> {
      for (const staff of staffById.values()) {
        if (staff.authUserId === authUserId && staff.deactivatedAt === null) {
          return toStaffContext(staff);
        }
      }
      return null;
    },

    async findStaffBusinessId(staffId) {
      return staffById.get(staffId)?.businessId ?? null;
    },

    async createInvite({ businessId, role }) {
      const id = randomUUID();
      const code = randomUUID();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      invites.set(id, { id, businessId, code, role, createdAt: new Date(), expiresAt, redeemedAt: null, redeemedBy: null });
      return { id, code, expiresAt };
    },

    async redeemInvite({ code, authUserId, email }) {
      const alreadyActive = [...staffById.values()].some(
        (s) => s.authUserId === authUserId && s.deactivatedAt === null,
      );
      if (alreadyActive) {
        return { outcome: 'already_staff' };
      }

      const invite = [...invites.values()].find((i) => i.code === code);
      if (!invite || invite.redeemedAt !== null || invite.expiresAt.getTime() <= Date.now()) {
        return { outcome: 'invalid_code' };
      }
      invite.redeemedAt = new Date();

      const deactivated = [...staffById.values()].find(
        (s) => s.businessId === invite.businessId && s.authUserId === authUserId && s.deactivatedAt !== null,
      );

      let staffId: string;
      if (deactivated) {
        deactivated.deactivatedAt = null;
        deactivated.deactivatedBy = null;
        deactivated.role = invite.role;
        staffId = deactivated.id;
      } else {
        staffId = randomUUID();
        staffById.set(staffId, {
          id: staffId,
          businessId: invite.businessId,
          email,
          role: invite.role,
          authUserId,
          deactivatedAt: null,
          deactivatedBy: null,
          business: placeholderBusiness(invite.businessId),
        });
      }
      invite.redeemedBy = staffId;

      return { outcome: 'redeemed', businessId: invite.businessId, role: invite.role };
    },

    async revokeInvite({ inviteId, businessId }) {
      const invite = invites.get(inviteId);
      if (
        !invite ||
        invite.businessId !== businessId ||
        invite.redeemedAt !== null ||
        invite.expiresAt.getTime() <= Date.now()
      ) {
        return { outcome: 'not_found' as const };
      }
      invite.redeemedAt = new Date();
      return { outcome: 'revoked' as const };
    },

    async listStaff(businessId) {
      const staff = [...staffById.values()]
        .filter((s) => s.businessId === businessId)
        .map((s) => ({ id: s.id, email: s.email, role: s.role, deactivatedAt: s.deactivatedAt }));

      const now = Date.now();
      const pendingInvites = [...invites.values()]
        .filter((i) => i.businessId === businessId && i.redeemedAt === null && i.expiresAt.getTime() > now)
        .map((i) => ({ id: i.id, role: i.role, createdAt: i.createdAt, expiresAt: i.expiresAt }));

      return { staff, pendingInvites };
    },

    async deactivateStaff({ staffId, deactivatedBy }) {
      const target = staffById.get(staffId);
      if (!target || target.deactivatedAt !== null) {
        return { outcome: 'not_found' };
      }

      if (target.role === 'owner') {
        const activeOwners = [...staffById.values()].filter(
          (s) => s.businessId === target.businessId && s.role === 'owner' && s.deactivatedAt === null,
        );
        if (activeOwners.length <= 1) {
          return { outcome: 'last_owner' };
        }
      }

      target.deactivatedAt = new Date();
      target.deactivatedBy = deactivatedBy;
      return { outcome: 'deactivated' };
    },
  };

  function addStaff(input: { authUserId: string; businessId: string; email?: string; role?: StaffRole }): StaffContext {
    const id = randomUUID();
    const staff: StoredStaff = {
      id,
      businessId: input.businessId,
      email: input.email ?? 'staff@example.com',
      role: input.role ?? 'owner',
      authUserId: input.authUserId,
      deactivatedAt: null,
      deactivatedBy: null,
      business: placeholderBusiness(input.businessId),
    };
    staffById.set(id, staff);
    return toStaffContext(staff);
  }

  return {
    port,

    /** Registers a staff member as reachable via `authUserId`, returning
     * both — pass `staff.id` where a test needs it (e.g. asserting who a
     * visit/redemption was `confirmedBy`). */
    addStaff,

    /** For the shared StaffPort contract suite — no real business row
     * exists in this fake, so any unique id is a valid "business." */
    async seedBusiness(): Promise<{ id: string }> {
      return { id: randomUUID() };
    },

    /** For the shared StaffPort contract suite — a thin wrapper over
     * addStaff returning just the id shape the contract needs. */
    async seedStaff(input: { businessId: string; authUserId: string; role?: StaffRole }): Promise<{ id: string }> {
      return { id: addStaff(input).id };
    },
  };
}
