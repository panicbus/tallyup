import { randomUUID } from 'node:crypto';
import { normalizeEmail } from '@tallyup/shared';
import type { InviteDescription, StaffContext, StaffPort } from '../data-access/staff-port.js';
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
  /** Normalized, as the real column stores it. */
  email: string;
  role: StaffRole;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedBy: string | null;
}

export function createInMemoryStaffPort() {
  const staffById = new Map<string, StoredStaff>();
  const invites = new Map<string, StoredInvite>();
  const businessesById = new Map<string, StaffContext['business']>();

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

  // A business seeded through seedBusiness carries a real name/slug for
  // describeInvite to return; one referenced only by id (route tests that
  // seed on a different port) falls back to a placeholder.
  function businessView(businessId: string): StaffContext['business'] {
    return businessesById.get(businessId) ?? placeholderBusiness(businessId);
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

    async createInvite({ businessId, email, role, createdBy }) {
      const normalizedEmail = normalizeEmail(email);

      // Supersede any still-live invite to the same address here.
      for (const existing of invites.values()) {
        if (
          existing.businessId === businessId &&
          existing.email === normalizedEmail &&
          existing.redeemedAt === null &&
          existing.expiresAt.getTime() > Date.now()
        ) {
          existing.redeemedAt = new Date();
        }
      }

      const id = randomUUID();
      const code = randomUUID();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      invites.set(id, {
        id,
        businessId,
        code,
        email: normalizedEmail,
        role,
        createdBy,
        createdAt: new Date(),
        expiresAt,
        redeemedAt: null,
        redeemedBy: null,
      });
      return { id, code, expiresAt };
    },

    async describeInvite(code): Promise<InviteDescription | null> {
      const invite = [...invites.values()].find((i) => i.code === code);
      if (!invite || invite.redeemedAt !== null || invite.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      const business = businessView(invite.businessId);
      return {
        businessName: business.name,
        businessSlug: business.slug,
        invitedBy: staffById.get(invite.createdBy)?.email ?? '',
        role: invite.role,
        email: invite.email,
        expiresAt: invite.expiresAt,
      };
    },

    async redeemInvite({ code, authUserId, email }) {
      // 1. Live invite, or invalid_code. Non-consuming.
      const invite = [...invites.values()].find((i) => i.code === code);
      if (!invite || invite.redeemedAt !== null || invite.expiresAt.getTime() <= Date.now()) {
        return { outcome: 'invalid_code' };
      }

      // 2. The invite is a credential for one address. Do not consume on a
      //    mismatch, so a forwarded link still works for its real recipient.
      if (normalizeEmail(invite.email) !== normalizeEmail(email)) {
        return { outcome: 'wrong_account' };
      }

      // 3. One identity, one active business. Checked before consuming.
      const alreadyActive = [...staffById.values()].some(
        (s) => s.authUserId === authUserId && s.deactivatedAt === null,
      );
      if (alreadyActive) {
        return { outcome: 'already_staff' };
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
        deactivated.email = invite.email;
        staffId = deactivated.id;
      } else {
        staffId = randomUUID();
        staffById.set(staffId, {
          id: staffId,
          businessId: invite.businessId,
          email: invite.email,
          role: invite.role,
          authUserId,
          deactivatedAt: null,
          deactivatedBy: null,
          business: businessView(invite.businessId),
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
        .map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.createdAt, expiresAt: i.expiresAt }));

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
      business: businessView(input.businessId),
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
     * exists in this fake, so any unique id is a valid "business." The
     * name/slug are remembered so describeInvite can return them. */
    async seedBusiness(): Promise<{ id: string; name: string; slug: string }> {
      const id = randomUUID();
      const business = placeholderBusiness(id);
      businessesById.set(id, business);
      return { id, name: business.name, slug: business.slug };
    },

    /** For the shared StaffPort contract suite — a thin wrapper over
     * addStaff returning just the id/email shape the contract needs. */
    async seedStaff(input: {
      businessId: string;
      authUserId: string;
      role?: StaffRole;
    }): Promise<{ id: string; email: string }> {
      const staff = addStaff({ ...input, email: `staff-${randomUUID()}@example.com` });
      return { id: staff.id, email: staff.email };
    },
  };
}
