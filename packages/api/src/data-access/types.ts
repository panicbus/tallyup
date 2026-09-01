import type { ColumnType, Generated } from 'kysely';

type CreatedAt = ColumnType<Date, string | Date | undefined, never>;

export interface Database {
  businesses: BusinessesTable;
  staff: StaffTable;
  customers: CustomersTable;
  pending_checkins: PendingCheckinsTable;
  visits: VisitsTable;
  redemptions: RedemptionsTable;
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
  role: string;
  created_at: CreatedAt;
  /** The Supabase Auth user id (`sub` claim) this staff row signs in as.
   * Null until W8's onboarding (or a manual seed) provisions the account. */
  auth_user_id: string | null;
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
