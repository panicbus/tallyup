import type { ColumnType, Generated } from 'kysely';

type CreatedAt = ColumnType<Date, string | Date | undefined, never>;

/** The full set of staff roles — also enforced at the database with a CHECK
 * constraint (migration 0012), so this union and that constraint must be
 * kept in sync by hand. */
export type StaffRole = 'owner' | 'staff';

export interface Database {
  businesses: BusinessesTable;
  staff: StaffTable;
  customers: CustomersTable;
  pending_checkins: PendingCheckinsTable;
  visits: VisitsTable;
  redemptions: RedemptionsTable;
  sms_consents: SmsConsentsTable;
  staff_invites: StaffInvitesTable;
}

export interface BusinessesTable {
  id: Generated<string>;
  name: string;
  slug: string;
  reward_threshold: number;
  reward_description: string;
  created_at: CreatedAt;
  /** Public Supabase Storage URL of the business's uploaded logo, or null
   * if they haven't set one. The bytes never pass through this API — the
   * browser uploads them directly and sends back the URL, which the route
   * validates against the caller's own storage folder before it lands
   * here (see services/logo-url.ts). */
  logo_url: string | null;
}

export interface StaffTable {
  id: Generated<string>;
  business_id: string;
  email: string;
  role: StaffRole;
  created_at: CreatedAt;
  /** The Supabase Auth user id (`sub` claim) this staff row signs in as.
   * Null until W8's onboarding (or a manual seed) provisions the account. */
  auth_user_id: string | null;
  /** Null while active. Never hard-deleted (no ON DELETE on the FKs from
   * visits/redemptions), so this is the only removal path. auth_user_id is
   * never cleared on deactivation — see the partial unique index below. */
  deactivated_at: Date | string | null;
  deactivated_by: string | null;
}

export interface CustomersTable {
  id: Generated<string>;
  business_id: string;
  phone: string;
  points: Generated<number>;
  created_at: CreatedAt;
}

export interface PendingCheckinsTable {
  id: Generated<string>;
  business_id: string;
  phone: string;
  created_at: CreatedAt;
  expires_at: Date | string;
  /** Null until confirmed. Never deleted on confirm (unlike the original
   * W2 design) — this column is the fraud gate now, and its presence is
   * what the customer-facing status poll (W5) detects. */
  confirmed_at: Date | string | null;
}

export interface VisitsTable {
  id: Generated<string>;
  business_id: string;
  customer_id: string;
  confirmed_by: string;
  created_at: CreatedAt;
}

export interface RedemptionsTable {
  id: Generated<string>;
  business_id: string;
  customer_id: string;
  confirmed_by: string;
  threshold_applied: number;
  created_at: CreatedAt;
}

/** Append-only SMS consent ledger — never updated or deleted. Keyed on
 * (business_id, phone), not customer_id: consent is captured at check-in
 * submission, before confirmCheckin has created (or incremented) any
 * customer row. */
export interface SmsConsentsTable {
  id: Generated<string>;
  business_id: string;
  phone: string;
  consented_at: CreatedAt;
  language: string;
  ip: string | null;
  user_agent: string | null;
}

/** A bearer credential granting access to a business — only the hash is
 * ever stored. Single-use: `redeemed_at`/`redeemed_by` are set together, in
 * a guarded update, never a plain UPDATE after a separate read. */
export interface StaffInvitesTable {
  id: Generated<string>;
  business_id: string;
  code_hash: string;
  role: StaffRole;
  created_by: string;
  created_at: CreatedAt;
  expires_at: Date | string;
  redeemed_at: Date | string | null;
  redeemed_by: string | null;
}
