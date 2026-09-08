import type { CheckInPort, CustomerRosterEntry, CustomerSortField, SortDirection } from '../data-access/check-in-port.js';
import { maskPhone } from './phone-masking.js';

export interface RosterEntry {
  id: string;
  maskedPhone: string;
  points: number;
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
    maskedPhone: maskPhone(entry.phone),
    points: entry.points,
    joinedAt: entry.createdAt,
    hasSmsConsent: entry.hasSmsConsent,
  };
}

/** The staff-facing customer roster — masked, never the raw port shape. */
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

/** The full roster for CSV export — same masking as listCustomers, applied
 * in the same place, so the export can never become a way to bypass it. */
export async function listAllCustomersForExport(
  port: Pick<CheckInPort, 'listAllCustomers'>,
  businessId: string,
): Promise<RosterEntry[]> {
  const entries = await port.listAllCustomers(businessId);
  return entries.map(toRosterEntry);
}
