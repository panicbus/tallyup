import { describe, expect } from 'vitest';
import type { StaffPort } from '../data-access/staff-port.js';
import type { StaffRole } from '../data-access/types.js';

export interface StaffPortContractSetup {
  port: StaffPort;
  seedBusiness(): Promise<{ id: string; name: string; slug: string }>;
  seedStaff(input: { businessId: string; authUserId: string; role?: StaffRole }): Promise<{ id: string; email: string }>;
}

// Same generic-over-fixtures shape as check-in-port-contract.ts: redeemInvite
// and deactivateStaff each open their own transaction, so the real-adapter
// path needs the non-transactional `realDb` fixture, not the rollback-
// wrapped `db` one. See that file's comment for the full explanation.
type TestFn<Fixtures> = (name: string, fn: (fixtures: Fixtures) => Promise<void>) => void;

/**
 * Behavioral assertions run against any StaffPort implementation. Invoked
 * once for the in-memory fake and once for the real Kysely adapter so
 * neither can silently drift from the other — see
 * in-memory-staff-port.test.ts and kysely-staff-port.integration.test.ts.
 */
export function runStaffPortContractTests<Fixtures extends { realDb?: unknown }>(
  test: TestFn<Fixtures>,
  createSetup: (fixtures: Fixtures) => Promise<StaffPortContractSetup>,
): void {
  describe('StaffPort contract', () => {
    test('createInvite then redeemInvite creates a new staff member with the invited role', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const invite = await port.createInvite({
        businessId: business.id,
        email: 'new-staff@example.com',
        role: 'staff',
        createdBy: owner.id,
      });

      const result = await port.redeemInvite({
        code: invite.code,
        authUserId: crypto.randomUUID(),
        email: 'new-staff@example.com',
      });

      expect(result).toEqual({ outcome: 'redeemed', businessId: business.id, role: 'staff' });
    });

    test('a code can only ever be redeemed once', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const invite = await port.createInvite({
        businessId: business.id,
        email: 'shared@example.com',
        role: 'staff',
        createdBy: owner.id,
      });

      const first = await port.redeemInvite({ code: invite.code, authUserId: crypto.randomUUID(), email: 'shared@example.com' });
      const second = await port.redeemInvite({ code: invite.code, authUserId: crypto.randomUUID(), email: 'shared@example.com' });

      expect(first.outcome).toBe('redeemed');
      expect(second).toEqual({ outcome: 'invalid_code' });
    });

    test('redeeming an unknown code fails', async ({ realDb }) => {
      const { port } = await createSetup({ realDb } as Fixtures);

      const result = await port.redeemInvite({ code: 'not-a-real-code', authUserId: crypto.randomUUID(), email: 'x@example.com' });

      expect(result).toEqual({ outcome: 'invalid_code' });
    });

    test('redeemInvite rejects an account whose email differs from the invited address, and does not consume the invite', async ({
      realDb,
    }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const invite = await port.createInvite({
        businessId: business.id,
        email: 'invited@example.com',
        role: 'staff',
        createdBy: owner.id,
      });

      const wrong = await port.redeemInvite({
        code: invite.code,
        authUserId: crypto.randomUUID(),
        email: 'someone-else@example.com',
      });
      const right = await port.redeemInvite({
        code: invite.code,
        authUserId: crypto.randomUUID(),
        email: 'invited@example.com',
      });

      expect(wrong).toEqual({ outcome: 'wrong_account' });
      expect(right).toEqual({ outcome: 'redeemed', businessId: business.id, role: 'staff' });
    });

    test('redeemInvite matches the invited address case-insensitively and ignoring surrounding whitespace', async ({
      realDb,
    }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const invite = await port.createInvite({
        businessId: business.id,
        email: '  Invited.Person@Example.com  ',
        role: 'staff',
        createdBy: owner.id,
      });

      const result = await port.redeemInvite({
        code: invite.code,
        authUserId: crypto.randomUUID(),
        email: 'invited.person@example.com',
      });

      expect(result).toEqual({ outcome: 'redeemed', businessId: business.id, role: 'staff' });
    });

    test('an unknown code is invalid_code even for an identity that already has an active staff row', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const existingAuthUserId = crypto.randomUUID();
      await seedStaff({ businessId: business.id, authUserId: existingAuthUserId, role: 'owner' });

      const result = await port.redeemInvite({ code: 'not-a-real-code', authUserId: existingAuthUserId, email: 'x@example.com' });

      expect(result).toEqual({ outcome: 'invalid_code' });
    });

    test('a revoked invite can no longer be redeemed and drops off the pending list', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const invite = await port.createInvite({
        businessId: business.id,
        email: 'a@example.com',
        role: 'staff',
        createdBy: owner.id,
      });

      const revoke = await port.revokeInvite({ inviteId: invite.id, businessId: business.id });
      const redeem = await port.redeemInvite({ code: invite.code, authUserId: crypto.randomUUID(), email: 'a@example.com' });
      const roster = await port.listStaff(business.id);

      expect(revoke).toEqual({ outcome: 'revoked' });
      expect(redeem).toEqual({ outcome: 'invalid_code' });
      expect(roster.pendingInvites).toEqual([]);
    });

    test('revokeInvite will not touch an invite belonging to another business', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const businessA = await seedBusiness();
      const businessB = await seedBusiness();
      const ownerA = await seedStaff({ businessId: businessA.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const invite = await port.createInvite({
        businessId: businessA.id,
        email: 'a@example.com',
        role: 'staff',
        createdBy: ownerA.id,
      });

      const crossTenant = await port.revokeInvite({ inviteId: invite.id, businessId: businessB.id });
      const stillRedeemable = await port.redeemInvite({
        code: invite.code,
        authUserId: crypto.randomUUID(),
        email: 'a@example.com',
      });

      expect(crossTenant).toEqual({ outcome: 'not_found' });
      expect(stillRedeemable.outcome).toBe('redeemed');
    });

    test('revoking an already-revoked invite is not_found', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const invite = await port.createInvite({
        businessId: business.id,
        email: 'a@example.com',
        role: 'staff',
        createdBy: owner.id,
      });

      await port.revokeInvite({ inviteId: invite.id, businessId: business.id });
      const second = await port.revokeInvite({ inviteId: invite.id, businessId: business.id });

      expect(second).toEqual({ outcome: 'not_found' });
    });

    test('redeeming fails for an identity that already has an active staff row anywhere, without consuming the invite', async ({
      realDb,
    }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const businessA = await seedBusiness();
      const businessB = await seedBusiness();
      const owner = await seedStaff({ businessId: businessA.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const existingAuthUserId = crypto.randomUUID();
      await seedStaff({ businessId: businessA.id, authUserId: existingAuthUserId, role: 'staff' });
      const invite = await port.createInvite({
        businessId: businessB.id,
        email: 'x@example.com',
        role: 'staff',
        createdBy: owner.id,
      });

      const blocked = await port.redeemInvite({ code: invite.code, authUserId: existingAuthUserId, email: 'x@example.com' });
      const stillRedeemable = await port.redeemInvite({
        code: invite.code,
        authUserId: crypto.randomUUID(),
        email: 'x@example.com',
      });

      expect(blocked).toEqual({ outcome: 'already_staff' });
      expect(stillRedeemable.outcome).toBe('redeemed');
    });

    test('reactivates a deactivated staff row at the same business rather than creating a second one', async ({
      realDb,
    }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const authUserId = crypto.randomUUID();
      const original = await seedStaff({ businessId: business.id, authUserId, role: 'staff' });
      await port.deactivateStaff({ staffId: original.id, deactivatedBy: owner.id });

      const invite = await port.createInvite({
        businessId: business.id,
        email: 'rehired@example.com',
        role: 'owner',
        createdBy: owner.id,
      });
      const result = await port.redeemInvite({ code: invite.code, authUserId, email: 'rehired@example.com' });

      expect(result).toEqual({ outcome: 'redeemed', businessId: business.id, role: 'owner' });
      const roster = await port.listStaff(business.id);
      const matching = roster.staff.filter((s) => s.id === original.id);
      expect(matching).toHaveLength(1);
      expect(matching[0]).toMatchObject({ role: 'owner', deactivatedAt: null });
      // Confirms it's exactly one row for this person, not a second one —
      // the owner (unaffected) plus the one reactivated row.
      expect(roster.staff).toHaveLength(2);
    });

    test('reactivating a deactivated staff member updates their email to the invited address', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const authUserId = crypto.randomUUID();
      const original = await seedStaff({ businessId: business.id, authUserId, role: 'staff' });
      await port.deactivateStaff({ staffId: original.id, deactivatedBy: owner.id });

      const invite = await port.createInvite({
        businessId: business.id,
        email: 'new-address@example.com',
        role: 'staff',
        createdBy: owner.id,
      });
      await port.redeemInvite({ code: invite.code, authUserId, email: 'new-address@example.com' });

      const roster = await port.listStaff(business.id);
      expect(roster.staff.find((s) => s.id === original.id)?.email).toBe('new-address@example.com');
    });

    test('creating a second invite for the same address at the same business supersedes the first', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });

      const first = await port.createInvite({
        businessId: business.id,
        email: 'teammate@example.com',
        role: 'staff',
        createdBy: owner.id,
      });
      const second = await port.createInvite({
        businessId: business.id,
        email: 'teammate@example.com',
        role: 'owner',
        createdBy: owner.id,
      });

      const staleRedeem = await port.redeemInvite({
        code: first.code,
        authUserId: crypto.randomUUID(),
        email: 'teammate@example.com',
      });
      const freshRedeem = await port.redeemInvite({
        code: second.code,
        authUserId: crypto.randomUUID(),
        email: 'teammate@example.com',
      });
      const roster = await port.listStaff(business.id);

      expect(staleRedeem).toEqual({ outcome: 'invalid_code' });
      expect(freshRedeem).toEqual({ outcome: 'redeemed', businessId: business.id, role: 'owner' });
      // The superseded invite is gone from the pending list too.
      expect(roster.pendingInvites).toHaveLength(0);
    });

    test('describeInvite returns the business, inviter, role, invited email, and expiry for a live code', async ({
      realDb,
    }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const invite = await port.createInvite({
        businessId: business.id,
        email: 'Invitee@Example.com',
        role: 'owner',
        createdBy: owner.id,
      });

      const description = await port.describeInvite(invite.code);

      expect(description).toEqual({
        businessName: business.name,
        businessSlug: business.slug,
        invitedBy: owner.email,
        role: 'owner',
        email: 'invitee@example.com',
        expiresAt: invite.expiresAt,
      });
    });

    test('describeInvite returns null for an unknown, revoked, or already-redeemed code', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });

      const revoked = await port.createInvite({
        businessId: business.id,
        email: 'revoked@example.com',
        role: 'staff',
        createdBy: owner.id,
      });
      await port.revokeInvite({ inviteId: revoked.id, businessId: business.id });

      const redeemed = await port.createInvite({
        businessId: business.id,
        email: 'redeemed@example.com',
        role: 'staff',
        createdBy: owner.id,
      });
      await port.redeemInvite({ code: redeemed.code, authUserId: crypto.randomUUID(), email: 'redeemed@example.com' });

      expect(await port.describeInvite('not-a-real-code')).toBeNull();
      expect(await port.describeInvite(revoked.code)).toBeNull();
      expect(await port.describeInvite(redeemed.code)).toBeNull();
    });

    test('listStaff reports the invited email on each pending invite', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      await port.createInvite({
        businessId: business.id,
        email: 'Pending.Person@Example.com',
        role: 'staff',
        createdBy: owner.id,
      });

      const roster = await port.listStaff(business.id);

      expect(roster.pendingInvites).toHaveLength(1);
      expect(roster.pendingInvites[0]?.email).toBe('pending.person@example.com');
    });

    test('listStaff only reports unredeemed, unexpired invites for that business', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const businessA = await seedBusiness();
      const businessB = await seedBusiness();
      const ownerA = await seedStaff({ businessId: businessA.id, authUserId: crypto.randomUUID(), role: 'owner' });
      await seedStaff({ businessId: businessB.id, authUserId: crypto.randomUUID(), role: 'owner' });
      await port.createInvite({ businessId: businessA.id, email: 'p1@example.com', role: 'staff', createdBy: ownerA.id });
      const redeemedInvite = await port.createInvite({
        businessId: businessA.id,
        email: 'p2@example.com',
        role: 'staff',
        createdBy: ownerA.id,
      });
      await port.redeemInvite({ code: redeemedInvite.code, authUserId: crypto.randomUUID(), email: 'p2@example.com' });
      await port.createInvite({ businessId: businessB.id, email: 'p3@example.com', role: 'staff', createdBy: ownerA.id });

      const roster = await port.listStaff(businessA.id);

      expect(roster.pendingInvites).toHaveLength(1);
    });

    test('deactivateStaff blocks removing the last active owner', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });

      const result = await port.deactivateStaff({ staffId: owner.id, deactivatedBy: owner.id });

      expect(result).toEqual({ outcome: 'last_owner' });
    });

    test('deactivateStaff succeeds when another active owner remains', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const ownerA = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const ownerB = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });

      const result = await port.deactivateStaff({ staffId: ownerB.id, deactivatedBy: ownerA.id });

      expect(result).toEqual({ outcome: 'deactivated' });
    });

    test('deactivateStaff never blocks removing a non-owner, regardless of owner count', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const owner = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const employee = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'staff' });

      const result = await port.deactivateStaff({ staffId: employee.id, deactivatedBy: owner.id });

      expect(result).toEqual({ outcome: 'deactivated' });
    });

    test('deactivateStaff returns not_found for an unknown id', async ({ realDb }) => {
      const { port } = await createSetup({ realDb } as Fixtures);

      const result = await port.deactivateStaff({ staffId: crypto.randomUUID(), deactivatedBy: crypto.randomUUID() });

      expect(result).toEqual({ outcome: 'not_found' });
    });

    test('deactivateStaff returns not_found for an already-deactivated staff member', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const ownerA = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      const ownerB = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID(), role: 'owner' });
      await port.deactivateStaff({ staffId: ownerB.id, deactivatedBy: ownerA.id });

      const result = await port.deactivateStaff({ staffId: ownerB.id, deactivatedBy: ownerA.id });

      expect(result).toEqual({ outcome: 'not_found' });
    });

    test('findStaffBusinessId resolves the owning business', async ({ realDb }) => {
      const { port, seedBusiness, seedStaff } = await createSetup({ realDb } as Fixtures);
      const business = await seedBusiness();
      const staff = await seedStaff({ businessId: business.id, authUserId: crypto.randomUUID() });

      expect(await port.findStaffBusinessId(staff.id)).toBe(business.id);
    });

    test('findStaffBusinessId returns null for an unknown id', async ({ realDb }) => {
      const { port } = await createSetup({ realDb } as Fixtures);

      expect(await port.findStaffBusinessId(crypto.randomUUID())).toBeNull();
    });
  });
}
