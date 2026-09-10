export interface Business {
  id: string;
  name: string;
  rewardThreshold: number;
  rewardDescription: string;
  /** Public URL of the shop's logo, or null if unset. Reaches customers
   * (the check-in page and punch card), so it must stay publicly readable. */
  logoUrl: string | null;
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

/** The customer-facing status poll's confirmed shape — deliberately narrower
 * than `Customer`. No `phone`: the customer already knows their own number,
 * and this endpoint is public/unauthenticated, so the response must not
 * carry anything an id-holder shouldn't be able to read back out. */
export interface CheckinStatusCustomer {
  id: string;
  points: number;
}

/** One row of the staff-facing customer roster. Returns the raw phone —
 * masking is a services/ concern, same convention as QueuedPendingCheckin. */
export interface CustomerRosterEntry {
  id: string;
  phone: string;
  /** Unspent balance toward the next reward. */
  points: number;
  createdAt: Date;
  hasSmsConsent: boolean;
  /** Every point the customer has ever earned (one per confirmed visit),
   * ignoring what they've since spent on rewards. */
  lifetimePoints: number;
  /** How many rewards this customer has redeemed. */
  rewardsGiven: number;
}

export interface CustomerRosterPage {
  items: CustomerRosterEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export type CustomerSortField = 'points' | 'joined';
export type SortDirection = 'asc' | 'desc';

/** Headline counts for the staff dashboard. `checkins`/`newCustomers`/
 * `rewards` are all "since the cutoff the caller passed"; the window itself
 * is the caller's choice, not baked in here. */
export interface BusinessStats {
  /** Confirmed check-ins (`visits` rows) recorded since the cutoff. */
  checkins: number;
  /** Customers first seen at this business since the cutoff. */
  newCustomers: number;
  /** Rewards redeemed since the cutoff. */
  rewards: number;
}

export type ConfirmCheckinResult =
  | { outcome: 'confirmed'; customer: Customer; business: Business }
  | { outcome: 'not_found' };

export type RedeemResult =
  | { outcome: 'redeemed'; customer: Customer; business: Business }
  | { outcome: 'not_eligible' };

export type CheckinStatusResult =
  | { status: 'pending'; expiresAt: Date }
  | { status: 'confirmed'; customer: CheckinStatusCustomer; business: Business }
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
   * unguessable pending-check-in id the customer already holds. The
   * `confirmed` state is only reported for a short window after
   * confirmation (see the adapter) — ids are never deleted, so without a
   * bound this would otherwise be a permanent, unauthenticated read of the
   * customer's current points balance. */
  getCheckinStatus(pendingCheckinId: string): Promise<CheckinStatusResult>;
  /** Tenant-isolation lookups: which business a resource belongs to, so a
   * route can 403 a staff member acting outside their own business before
   * confirmCheckin/redeem ever run. Null if the resource doesn't exist. */
  findPendingCheckinBusinessId(pendingCheckinId: string): Promise<string | null>;
  findCustomerBusinessId(customerId: string): Promise<string | null>;
  /** Appends one row to the SMS consent ledger — never an update, even for
   * a phone that has consented before. Called at check-in submission, not
   * confirmation: consent must be recorded the instant it's given, by the
   * customer, not up to 20 minutes later by the confirming staff member. */
  recordConsent(input: {
    businessId: string;
    phone: string;
    language: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void>;
  /** Whether any consent has ever been recorded for this phone at this
   * business — an existence check, not a lookup of the record itself. */
  hasConsented(input: { businessId: string; phone: string }): Promise<boolean>;
  /** The staff-facing customer roster, one business at a time. `sort`/`dir`
   * are already-validated enums by the time they reach here — the route
   * owns rejecting anything else, so this never takes a raw string that
   * could end up interpolated into a query. */
  listCustomers(input: {
    businessId: string;
    page: number;
    pageSize: number;
    sort: CustomerSortField;
    dir: SortDirection;
  }): Promise<CustomerRosterPage>;
  /** The full roster, unpaginated, oldest first — for CSV export. A separate
   * method rather than `listCustomers` with a huge pageSize: this is honest
   * about what it does, and pilot scale (a few hundred customers per shop at
   * most) makes an unpaginated fetch fine. */
  listAllCustomers(businessId: string): Promise<CustomerRosterEntry[]>;
  /** Headline dashboard counts for one business since `since`. The window is
   * the caller's — this just counts rows past the cutoff. */
  getBusinessStats(input: { businessId: string; since: Date }): Promise<BusinessStats>;
}
