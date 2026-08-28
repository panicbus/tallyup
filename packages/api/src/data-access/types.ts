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
}

export interface StaffTable {
  id: Generated<string>;
  business_id: string;
  email: string;
  role: string;
  created_at: CreatedAt;
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
