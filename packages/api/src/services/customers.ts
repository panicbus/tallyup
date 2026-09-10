import { formatUsPhone } from '@tallyup/shared';
import type { CheckInPort, CustomerRosterEntry, CustomerSortField, SortDirection } from '../data-access/check-in-port.js';
import { maskPhone } from './phone-masking.js';

export interface RosterEntry {
  id: string;
  /** The number as staff should see it: the full number, formatted
   * (XXX) XXX-XXXX, for a customer who opted in to SMS (they consented to
   * being contacted on it); masked to the last 4 digits for everyone else.
   * Never the raw E.164 number, so it stays safe to drop straight into a
   * CSV cell (a leading "+" reads as a formula in a spreadsheet). */
  displayPhone: string;
  /** Unspent balance toward the next reward. */
  points: number;
  /** Every point the customer has ever earned, one per confirmed visit,
   * ignoring what they have since spent on rewards. */
  lifetimePoints: number;
  /** How many rewards this customer has redeemed. */
  rewardsGiven: number;
  joinedAt: Date;
  hasSmsConsent: boolean;
}

export interface RosterPage {
  items: RosterEntry[];
  total: number;
  page: number;
  pageSize: number;
}

function toRosterEntry(entry: CustomerRosterEntry): RosterEntry {
  return {
    id: entry.id,
    displayPhone: entry.hasSmsConsent ? formatUsPhone(entry.phone) : maskPhone(entry.phone),
    points: entry.points,
    lifetimePoints: entry.lifetimePoints,
    rewardsGiven: entry.rewardsGiven,
    joinedAt: entry.createdAt,
    hasSmsConsent: entry.hasSmsConsent,
  };
}

/** The staff-facing customer roster — masked (unless the customer opted in),
 * never the raw port shape. */
export async function listCustomers(
  port: Pick<CheckInPort, 'listCustomers'>,
  input: { businessId: string; page: number; pageSize: number; sort: CustomerSortField; dir: SortDirection },
): Promise<RosterPage> {
  const result = await port.listCustomers(input);
  return {
    items: result.items.map(toRosterEntry),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

/** The full roster for CSV export — same phone handling as listCustomers,
 * applied in the same place, so the export can never become a way to bypass
 * it. */
export async function listAllCustomersForExport(
  port: Pick<CheckInPort, 'listAllCustomers'>,
  businessId: string,
): Promise<RosterEntry[]> {
  const entries = await port.listAllCustomers(businessId);
  return entries.map(toRosterEntry);
}
