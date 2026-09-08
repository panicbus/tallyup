import { createHash, randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import { findStaffByAuthUserId } from './staff.js';
import type { Database } from './types.js';
import type {
  CreatedInvite,
  DeactivateStaffResult,
  PendingInviteEntry,
  RedeemInviteResult,
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

    async createInvite({ businessId, role, createdBy }): Promise<CreatedInvite> {
      // 24 random bytes (192 bits), base64url-encoded — a bearer credential
      // granting access to a tenant, not a password, so a fast hash below
      // is the right tradeoff, not bcrypt/argon2 (a new dependency this
      // batch otherwise adds none of).
      const code = randomBytes(24).toString('base64url');
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

      const row = await db
        .insertInto('staff_invites')
        .values({
          business_id: businessId,
          code_hash: hashInviteCode(code),
          role,
          created_by: createdBy,
          expires_at: expiresAt,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      return { id: row.id, code, expiresAt };
    },

    async redeemInvite({ code, authUserId, email }): Promise<RedeemInviteResult> {
      return db.transaction().execute(async (trx) => {
        // Checked first, before the invite is touched at all — a request
        // that was always going to fail shouldn't burn a valid code.
        const existingActive = await trx
          .selectFrom('staff')
          .select('id')
          .where('auth_user_id', '=', authUserId)
          .where('deactivated_at', 'is', null)
          .executeTakeFirst();
        if (existingActive) {
          return { outcome: 'already_staff' };
        }

        // The fraud-gate shape, same as confirmCheckin: this update only
        // succeeds once per code, and only before it expires. Whether it
        // returns a row is the single source of truth for whether
        // redemption may proceed — a concurrent second redemption of the
        // same code always finds redeemed_at already set and loses.
        const invite = await trx
          .updateTable('staff_invites')
          .set({ redeemed_at: new Date() })
          .where('code_hash', '=', hashInviteCode(code))
          .where('redeemed_at', 'is', null)
          .where('expires_at', '>', new Date())
          .returning(['id', 'business_id', 'role'])
          .executeTakeFirst();
        if (!invite) {
          return { outcome: 'invalid_code' };
        }

        // Reactivate a matching deactivated row at this business rather
        // than inserting a second one — keeps this person's
        // visits/redemptions.confirmed_by history on a single staff id.
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
                .set({ deactivated_at: null, deactivated_by: null, role: invite.role })
                .where('id', '=', deactivated.id)
                .returning('id')
                .executeTakeFirstOrThrow()
            ).id
          : (
              await trx
                .insertInto('staff')
                .values({ business_id: invite.business_id, email, role: invite.role, auth_user_id: authUserId })
                .returning('id')
                .executeTakeFirstOrThrow()
            ).id;

        // Recorded after the fact, once a staff id exists to record — the
        // single-use guarantee above already comes from redeemed_at alone.
        await trx.updateTable('staff_invites').set({ redeemed_by: staffId }).where('id', '=', invite.id).execute();

        return { outcome: 'redeemed', businessId: invite.business_id, role: invite.role };
      });
    },

    async listStaff(businessId): Promise<StaffRoster> {
      const staffRows = await db
        .selectFrom('staff')
        .select(['id', 'email', 'role', 'deactivated_at'])
        .where('business_id', '=', businessId)
        .orderBy('created_at', 'asc')
        .execute();

      const inviteRows = await db
        .selectFrom('staff_invites')
        .select(['id', 'role', 'created_at', 'expires_at'])
        .where('business_id', '=', businessId)
        .where('redeemed_at', 'is', null)
        .where('expires_at', '>', new Date())
        .orderBy('created_at', 'asc')
        .execute();

      const staff: StaffListEntry[] = staffRows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      }));
      const pendingInvites: PendingInviteEntry[] = inviteRows.map((row) => ({
        id: row.id,
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
