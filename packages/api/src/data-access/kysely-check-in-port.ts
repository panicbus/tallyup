import type { Kysely } from 'kysely';
import type { Database } from './types.js';
import type { CheckInPort, ConfirmCheckinResult } from './check-in-port.js';

const PENDING_CHECKIN_TTL_MS = 20 * 60_000;

export function createKyselyCheckInPort(db: Kysely<Database>): CheckInPort {
  return {
    async findBusinessBySlug(slug) {
      const row = await db
        .selectFrom('businesses')
        .select(['id', 'reward_threshold'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      return row ? { id: row.id, rewardThreshold: row.reward_threshold } : null;
    },

    async createPendingCheckin({ businessId, phone }) {
      const expiresAt = new Date(Date.now() + PENDING_CHECKIN_TTL_MS);

      const row = await db
        .insertInto('pending_checkins')
        .values({ business_id: businessId, phone, expires_at: expiresAt })
        .onConflict((oc) => oc.columns(['business_id', 'phone']).doUpdateSet({ expires_at: expiresAt }))
        .returning(['id', 'expires_at'])
        .executeTakeFirstOrThrow();

      return { id: row.id, expiresAt: new Date(row.expires_at) };
    },

    async confirmCheckin({ pendingCheckinId, confirmedBy }): Promise<ConfirmCheckinResult> {
      return db.transaction().execute(async (trx) => {
        // The fraud gate: this delete only succeeds once per pending
        // check-in, and only before it expires. Whether it returns a row
        // is the single source of truth for whether this confirm may
        // proceed — everything else in this transaction is conditioned on it.
        const deleted = await trx
          .deleteFrom('pending_checkins')
          .where('id', '=', pendingCheckinId)
          .where('expires_at', '>', new Date())
          .returning(['business_id', 'phone'])
          .executeTakeFirst();

        if (!deleted) {
          return { outcome: 'not_found' };
        }

        // Creates the customer if this phone is new to this business,
        // increments points if returning — one statement, one round trip.
        const customer = await trx
          .insertInto('customers')
          .values({ business_id: deleted.business_id, phone: deleted.phone, points: 1 })
          .onConflict((oc) =>
            oc.columns(['business_id', 'phone']).doUpdateSet((eb) => ({
              points: eb('customers.points', '+', 1),
            })),
          )
          .returning(['id', 'phone', 'points'])
          .executeTakeFirstOrThrow();

        await trx
          .insertInto('visits')
          .values({ business_id: deleted.business_id, customer_id: customer.id, confirmed_by: confirmedBy })
          .execute();

        const business = await trx
          .selectFrom('businesses')
          .select(['id', 'reward_threshold'])
          .where('id', '=', deleted.business_id)
          .executeTakeFirstOrThrow();

        return {
          outcome: 'confirmed',
          customer: { id: customer.id, phone: customer.phone, points: customer.points },
          business: { id: business.id, rewardThreshold: business.reward_threshold },
        };
      });
    },
  };
}
