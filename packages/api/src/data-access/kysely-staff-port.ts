import { createHash, randomBytes } from 'node:crypto';
import { normalizeEmail } from '@tallyup/shared';
import type { Kysely } from 'kysely';
import { findStaffByAuthUserId } from './staff.js';
import type { Database } from './types.js';
import type {
  CreatedInvite,
  DeactivateStaffResult,
  InviteDescription,
  PendingInviteEntry,
  RedeemInviteResult,
  RevokeInviteResult,
  StaffListEntry,
  StaffPort,
  StaffRoster,
} from './staff-port.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

function hashInviteCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function createKyselyStaffPort(db: Kysely<Database>): StaffPort {
  return {
    findByAuthUserId: (authUserId) => findStaffByAuthUserId(db, authUserId),

    async findStaffBusinessId(staffId) {
      const row = await db.selectFrom('staff').select('business_id').where('id', '=', staffId).executeTakeFirst();
      return row?.business_id ?? null;
    },

    async createInvite({ businessId, email, role, createdBy }): Promise<CreatedInvite> {
      // 24 random bytes (192 bits), base64url-encoded — a bearer credential
      // granting access to a tenant, not a password, so a fast hash below
      // is the right tradeoff, not bcrypt/argon2 (a new dependency this
      // batch otherwise adds none of).
      const code = randomBytes(24).toString('base64url');
      const normalizedEmail = normalizeEmail(email);
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

      const row = await db.transaction().execute(async (trx) => {
        // Supersede any still-live invite to the same address at this
        // business. Only the hash is stored, so re-inviting is the only
        // resend path, and a corrected/re-sent invite must kill the stale
        // link. Same "consume via redeemed_at" idiom as revokeInvite.
        await trx
          .updateTable('staff_invites')
          .set({ redeemed_at: new Date() })
          .where('business_id', '=', businessId)
          .where('email', '=', normalizedEmail)
          .where('redeemed_at', 'is', null)
          .where('expires_at', '>', new Date())
          .execute();

        return trx
          .insertInto('staff_invites')
          .values({
            business_id: businessId,
            code_hash: hashInviteCode(code),
            email: normalizedEmail,
            role,
            created_by: createdBy,
            expires_at: expiresAt,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
      });

      return { id: row.id, code, expiresAt };
    },

    async describeInvite(code): Promise<InviteDescription | null> {
      const row = await db
        .selectFrom('staff_invites')
        .innerJoin('businesses', 'businesses.id', 'staff_invites.business_id')
        .innerJoin('staff', 'staff.id', 'staff_invites.created_by')
        .select([
          'businesses.name as business_name',
          'businesses.slug as business_slug',
          'staff.email as inviter_email',
          'staff_invites.email as invited_email',
          'staff_invites.role as role',
          'staff_invites.expires_at as expires_at',
        ])
        .where('staff_invites.code_hash', '=', hashInviteCode(code))
        .where('staff_invites.redeemed_at', 'is', null)
        .where('staff_invites.expires_at', '>', new Date())
        .executeTakeFirst();
      if (!row) {
        return null;
      }
      return {
        businessName: row.business_name,
        businessSlug: row.business_slug,
        invitedBy: row.inviter_email,
        role: row.role,
        email: row.invited_email,
        expiresAt: new Date(row.expires_at),
      };
    },

    async redeemInvite({ code, authUserId, email }): Promise<RedeemInviteResult> {
      return db.transaction().execute(async (trx) => {
        // 1. Find the live invite. Non-consuming: redeemed/expired/unknown
        //    all collapse to invalid_code, and the guarded consume below
        //    stays the sole authority on whether the code is spent.
        const invite = await trx
          .selectFrom('staff_invites')
          .select(['id', 'business_id', 'role', 'email'])
          .where('code_hash', '=', hashInviteCode(code))
          .where('redeemed_at', 'is', null)
          .where('expires_at', '>', new Date())
          .executeTakeFirst();
        if (!invite) {
          return { outcome: 'invalid_code' };
        }

        // 2. The invite is a credential for one specific address. A
        //    different signed-in account may not spend it -- and this must
        //    not consume it, so a forwarded link stays valid for its true
        //    recipient. `email` here is identity.email, already lowercased
        //    by Supabase; normalize both sides anyway.
        if (normalizeEmail(invite.email) !== normalizeEmail(email)) {
          return { outcome: 'wrong_account' };
        }

        // 3. One identity, one active business (also the partial unique
        //    index). Checked before consuming so a doomed redemption keeps
        //    the invite live for a retry from the right account.
        const existingActive = await trx
          .selectFrom('staff')
          .select('id')
          .where('auth_user_id', '=', authUserId)
          .where('deactivated_at', 'is', null)
          .executeTakeFirst();
        if (existingActive) {
          return { outcome: 'already_staff' };
        }

        // 4. Consume, guarded. The fraud-gate shape, same as confirmCheckin:
        //    whether this returns a row is the single source of truth for
        //    whether redemption proceeds -- a concurrent second redemption
        //    of the same code finds redeemed_at already set and loses.
        const consumed = await trx
          .updateTable('staff_invites')
          .set({ redeemed_at: new Date() })
          .where('id', '=', invite.id)
          .where('redeemed_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (!consumed) {
          return { outcome: 'invalid_code' };
        }

        // 5. Reactivate a matching deactivated row at this business rather
        //    than inserting a second one -- keeps this person's
        //    visits/redemptions.confirmed_by history on a single staff id.
        //    Refresh the stored email too: the invite's address is now the
        //    authoritative one for this person here.
        const deactivated = await trx
          .selectFrom('staff')
          .select('id')
          .where('business_id', '=', invite.business_id)
          .where('auth_user_id', '=', authUserId)
          .where('deactivated_at', 'is not', null)
          .executeTakeFirst();

        const staffId = deactivated
          ? (
              await trx
                .updateTable('staff')
                .set({ deactivated_at: null, deactivated_by: null, role: invite.role, email: invite.email })
                .where('id', '=', deactivated.id)
                .returning('id')
                .executeTakeFirstOrThrow()
            ).id
          : (
              await trx
                .insertInto('staff')
                .values({ business_id: invite.business_id, email: invite.email, role: invite.role, auth_user_id: authUserId })
                .returning('id')
                .executeTakeFirstOrThrow()
            ).id;

        // Recorded after the fact, once a staff id exists to record — the
        // single-use guarantee above already comes from redeemed_at alone.
        await trx.updateTable('staff_invites').set({ redeemed_by: staffId }).where('id', '=', invite.id).execute();

        return { outcome: 'redeemed', businessId: invite.business_id, role: invite.role };
      });
    },

    async revokeInvite({ inviteId, businessId }): Promise<RevokeInviteResult> {
      // Consuming the single-use slot (redeemed_at) is enough to nullify it:
      // the redeem guard is `redeemed_at is null`, and the pending-invite
      // list filters the same way, so a revoked invite vanishes from both.
      const revoked = await db
        .updateTable('staff_invites')
        .set({ redeemed_at: new Date() })
        .where('id', '=', inviteId)
        .where('business_id', '=', businessId)
        .where('redeemed_at', 'is', null)
        .where('expires_at', '>', new Date())
        .returning('id')
        .executeTakeFirst();

      return revoked ? { outcome: 'revoked' } : { outcome: 'not_found' };
    },

    async listStaff(businessId): Promise<StaffRoster> {
      const staffRows = await db
        .selectFrom('staff')
        .select(['id', 'email', 'name', 'role', 'deactivated_at'])
        .where('business_id', '=', businessId)
        .orderBy('created_at', 'asc')
        .execute();

      const inviteRows = await db
        .selectFrom('staff_invites')
        .select(['id', 'email', 'role', 'created_at', 'expires_at'])
        .where('business_id', '=', businessId)
        .where('redeemed_at', 'is', null)
        .where('expires_at', '>', new Date())
        .orderBy('created_at', 'asc')
        .execute();

      const staff: StaffListEntry[] = staffRows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      }));
      const pendingInvites: PendingInviteEntry[] = inviteRows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
      }));

      return { staff, pendingInvites };
    },

    async deactivateStaff({ staffId, deactivatedBy }): Promise<DeactivateStaffResult> {
      return db.transaction().execute(async (trx) => {
        const target = await trx
          .selectFrom('staff')
          .select(['id', 'business_id', 'role', 'deactivated_at'])
          .where('id', '=', staffId)
          .executeTakeFirst();
        // Collapses "doesn't exist" and "already deactivated" — same
        // reasoning as confirmCheckin's not_found: the caller has no reason
        // to distinguish them.
        if (!target || target.deactivated_at !== null) {
          return { outcome: 'not_found' };
        }

        if (target.role === 'owner') {
          // Locks every active owner row so a concurrent deactivation of a
          // different owner can't also pass this check — the second
          // transaction blocks here, then re-evaluates against the first
          // transaction's committed result once unblocked (standard
          // Postgres FOR UPDATE + read-committed re-check semantics).
          const activeOwners = await trx
            .selectFrom('staff')
            .select('id')
            .where('business_id', '=', target.business_id)
            .where('role', '=', 'owner')
            .where('deactivated_at', 'is', null)
            .forUpdate()
            .execute();
          if (activeOwners.length <= 1) {
            return { outcome: 'last_owner' };
          }
        }

        await trx
          .updateTable('staff')
          .set({ deactivated_at: new Date(), deactivated_by: deactivatedBy })
          .where('id', '=', staffId)
          .execute();

        return { outcome: 'deactivated' };
      });
    },
  };
}
