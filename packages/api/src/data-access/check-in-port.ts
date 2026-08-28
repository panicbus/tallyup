export interface Business {
  id: string;
  name: string;
  rewardThreshold: number;
  rewardDescription: string;
}

export interface Customer {
  id: string;
  phone: string;
  points: number;
}

export interface PendingCheckin {
  id: string;
  expiresAt: Date;
}

export interface QueuedPendingCheckin {
  id: string;
  phone: string;
  createdAt: Date;
}

export type ConfirmCheckinResult =
  | { outcome: 'confirmed'; customer: Customer; business: Business }
  | { outcome: 'not_found' };

export type RedeemResult =
  | { outcome: 'redeemed'; customer: Customer; business: Business }
  | { outcome: 'not_eligible' };

export type CheckinStatusResult =
  | { status: 'pending'; expiresAt: Date }
  | { status: 'confirmed'; customer: Customer; business: Business }
  | { status: 'expired' }
  | { status: 'not_found' };

/**
 * Coarse, transactional operations for the check-in loop. `confirmCheckin`
 * is the fraud gate: it must mark the pending row confirmed (a guarded
 * update, `WHERE confirmed_at IS NULL AND expires_at > now()` — never
 * deleted, so the customer-facing status poll has something to find),
 * create-or-increment the customer, and record the visit as one atomic
 * unit, so a pending check-in can never become a visit without going
 * through here. `redeem` is the same idea applied to rollover: the points
 * deduction and the eligibility check (points >= threshold) happen in one
 * guarded update, so a double-tap can't double-redeem. `not_eligible`
 * deliberately covers both "unknown customer" and "insufficient points" —
 * see confirmCheckin's `not_found` for the same reasoning.
 */
export interface CheckInPort {
  findBusinessBySlug(slug: string): Promise<Business | null>;
  createPendingCheckin(input: { businessId: string; phone: string }): Promise<PendingCheckin>;
  confirmCheckin(input: { pendingCheckinId: string; confirmedBy: string }): Promise<ConfirmCheckinResult>;
  redeem(input: { customerId: string; confirmedBy: string }): Promise<RedeemResult>;
  /** Unexpired, unconfirmed pending check-ins, oldest first. Returns raw
   * phone numbers — masking is a services/ concern, applied before this
   * ever reaches a route. */
  listPendingCheckins(businessId: string): Promise<QueuedPendingCheckin[]>;
  /** The customer-facing poll target — public, no auth, keyed only by the
   * unguessable pending-check-in id the customer already holds. */
  getCheckinStatus(pendingCheckinId: string): Promise<CheckinStatusResult>;
}
