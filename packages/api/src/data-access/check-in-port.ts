export interface Business {
  id: string;
  rewardThreshold: number;
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

export type ConfirmCheckinResult =
  | { outcome: 'confirmed'; customer: Customer; business: Business }
  | { outcome: 'not_found' };

export type RedeemResult =
  | { outcome: 'redeemed'; customer: Customer; business: Business }
  | { outcome: 'not_eligible' };

/**
 * Coarse, transactional operations for the check-in loop. `confirmCheckin`
 * is the fraud gate: it must delete the pending row, create-or-increment
 * the customer, and record the visit as one atomic unit, so a pending
 * check-in can never become a visit without going through here. `redeem`
 * is the same idea applied to rollover: the points deduction and the
 * eligibility check (points >= threshold) happen in one guarded update, so
 * a double-tap can't double-redeem. `not_eligible` deliberately covers both
 * "unknown customer" and "insufficient points" — see confirmCheckin's
 * `not_found` for the same reasoning.
 */
export interface CheckInPort {
  findBusinessBySlug(slug: string): Promise<Business | null>;
  createPendingCheckin(input: { businessId: string; phone: string }): Promise<PendingCheckin>;
  confirmCheckin(input: { pendingCheckinId: string; confirmedBy: string }): Promise<ConfirmCheckinResult>;
  redeem(input: { customerId: string; confirmedBy: string }): Promise<RedeemResult>;
}
