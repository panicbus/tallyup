import type { Kysely } from 'kysely';
import type { Database } from './types.js';
import type { Business, CheckInPort, ConfirmCheckinResult, RedeemResult } from './check-in-port.js';

const PENDING_CHECKIN_TTL_MS = 20 * 60_000;

function toBusiness(row: { id: string; name: string; reward_threshold: number; reward_description: string }): Business {
  return { id: row.id, name: row.name, rewardThreshold: row.reward_threshold, rewardDescription: row.reward_description };
}

export function createKyselyCheckInPort(db: Kysely<Database>): CheckInPort {
  return {
    async findBusinessBySlug(slug) {
      const row = await db
        .selectFrom('businesses')
        .select(['id', 'name', 'reward_threshold', 'reward_description'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      return row ? toBusiness(row) : null;
    },

    async createPendingCheckin({ businessId, phone }) {
      const expiresAt = new Date(Date.now() + PENDING_CHECKIN_TTL_MS);

      const row = await db
        .insertInto('pending_checkins')
        .values({ business_id: businessId, phone, expires_at: expiresAt })
        .onConflict((oc) =>
          // A fresh submission always starts a new pending state, even if
          // this (business_id, phone) pair was already confirmed before.
          oc.columns(['business_id', 'phone']).doUpdateSet({ expires_at: expiresAt, confirmed_at: null }),
        )
        .returning(['id', 'expires_at'])
        .executeTakeFirstOrThrow();

      return { id: row.id, expiresAt: new Date(row.expires_at) };
    },

    async confirmCheckin({ pendingCheckinId, confirmedBy }): Promise<ConfirmCheckinResult> {
      return db.transaction().execute(async (trx) => {
        // The fraud gate: this update only succeeds once per pending
        // check-in, and only before it expires. Whether it returns a row
        // is the single source of truth for whether this confirm may
        // proceed — everything else in this transaction is conditioned on
        // it. The row is never deleted (unlike W2's original design) so
        // the customer-facing status poll has something to find afterward.
        const confirmed = await trx
          .updateTable('pending_checkins')
          .set({ confirmed_at: new Date() })
          .where('id', '=', pendingCheckinId)
          .where('confirmed_at', 'is', null)
          .where('expires_at', '>', new Date())
          .returning(['business_id', 'phone'])
          .executeTakeFirst();

        if (!confirmed) {
          return { outcome: 'not_found' };
        }

        // Creates the customer if this phone is new to this business,
        // increments points if returning — one statement, one round trip.
        const customer = await trx
          .insertInto('customers')
          .values({ business_id: confirmed.business_id, phone: confirmed.phone, points: 1 })
          .onConflict((oc) =>
            oc.columns(['business_id', 'phone']).doUpdateSet((eb) => ({
              points: eb('customers.points', '+', 1),
            })),
          )
          .returning(['id', 'phone', 'points'])
          .executeTakeFirstOrThrow();

        await trx
          .insertInto('visits')
          .values({ business_id: confirmed.business_id, customer_id: customer.id, confirmed_by: confirmedBy })
          .execute();

        const business = await trx
          .selectFrom('businesses')
          .select(['id', 'name', 'reward_threshold', 'reward_description'])
          .where('id', '=', confirmed.business_id)
          .executeTakeFirstOrThrow();

        return {
          outcome: 'confirmed',
          customer: { id: customer.id, phone: customer.phone, points: customer.points },
          business: toBusiness(business),
        };
      });
    },

    async redeem({ customerId, confirmedBy }): Promise<RedeemResult> {
      return db.transaction().execute(async (trx) => {
        const customer = await trx
          .selectFrom('customers')
          .selectAll()
          .where('id', '=', customerId)
          .executeTakeFirst();

        if (!customer) {
          return { outcome: 'not_eligible' };
        }

        const business = await trx
          .selectFrom('businesses')
          .select(['id', 'name', 'reward_threshold', 'reward_description'])
          .where('id', '=', customer.business_id)
          .executeTakeFirstOrThrow();

        // The fraud gate: this update only succeeds if points are still
        // >= the threshold read moments ago, in this same transaction. A
        // concurrent redeem that already spent those points makes this
        // WHERE clause fail under Postgres's read-committed re-evaluation,
        // so a double-tap can't double-redeem.
        const updated = await trx
          .updateTable('customers')
          .set((eb) => ({ points: eb('points', '-', business.reward_threshold) }))
          .where('id', '=', customerId)
          .where('points', '>=', business.reward_threshold)
          .returning(['id', 'phone', 'points'])
          .executeTakeFirst();

        if (!updated) {
          return { outcome: 'not_eligible' };
        }

        await trx
          .insertInto('redemptions')
          .values({
            business_id: business.id,
            customer_id: customerId,
            confirmed_by: confirmedBy,
            threshold_applied: business.reward_threshold,
          })
          .execute();

        return {
          outcome: 'redeemed',
          customer: { id: updated.id, phone: updated.phone, points: updated.points },
          business: toBusiness(business),
        };
      });
    },

    async listPendingCheckins(businessId) {
      const rows = await db
        .selectFrom('pending_checkins')
        .select(['id', 'phone', 'created_at'])
        .where('business_id', '=', businessId)
        .where('confirmed_at', 'is', null)
        .where('expires_at', '>', new Date())
        .orderBy('created_at', 'asc')
        .execute();

      return rows.map((row) => ({ id: row.id, phone: row.phone, createdAt: new Date(row.created_at) }));
    },

    async getCheckinStatus(pendingCheckinId) {
      const pending = await db
        .selectFrom('pending_checkins')
        .select(['business_id', 'phone', 'expires_at', 'confirmed_at'])
        .where('id', '=', pendingCheckinId)
        .executeTakeFirst();

      if (!pending) {
        return { status: 'not_found' };
      }

      if (pending.confirmed_at !== null) {
        const business = await db
          .selectFrom('businesses')
          .select(['id', 'name', 'reward_threshold', 'reward_description'])
          .where('id', '=', pending.business_id)
          .executeTakeFirstOrThrow();

        const customer = await db
          .selectFrom('customers')
          .select(['id', 'phone', 'points'])
          .where('business_id', '=', pending.business_id)
          .where('phone', '=', pending.phone)
          .executeTakeFirstOrThrow();

        return { status: 'confirmed', customer, business: toBusiness(business) };
      }

      if (new Date(pending.expires_at).getTime() <= Date.now()) {
        return { status: 'expired' };
      }

      return { status: 'pending', expiresAt: new Date(pending.expires_at) };
    },
  };
}
