import { supabaseClient } from './supabase';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface MeResponse {
  id: string;
  email: string;
  role: string;
  business: {
    id: string;
    name: string;
    slug: string;
    rewardThreshold: number;
    rewardDescription: string;
    logoUrl: string | null;
  };
}

export interface QueuedPendingCheckin {
  id: string;
  maskedPhone: string;
  createdAt: string;
}

export interface RosterEntry {
  id: string;
  /** Full number, formatted (XXX) XXX-XXXX, for a customer who opted in to
   * SMS; masked to the last 4 digits for everyone else. The api decides
   * which and does the formatting. */
  displayPhone: string;
  /** Unspent balance toward the next reward. */
  points: number;
  /** Every point ever earned, one per confirmed visit, before rewards spent. */
  lifetimePoints: number;
  /** Rewards this customer has redeemed. */
  rewardsGiven: number;
  joinedAt: string;
  hasSmsConsent: boolean;
}

export interface RosterPage {
  items: RosterEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export type CustomerSortField = 'points' | 'joined';
export type SortDirection = 'asc' | 'desc';

interface CustomerSummary {
  id: string;
  maskedPhone: string;
  points: number;
}

// The status poll's confirmed shape is deliberately narrower — no phone at
// all, and only reported for a short window after confirmation. See
// CheckinStatusCustomer in the api's check-in-port.ts for why.
interface CheckinStatusCustomer {
  id: string;
  points: number;
}

export interface BusinessSummary {
  id: string;
  name: string;
  rewardThreshold: number;
  rewardDescription: string;
  logoUrl: string | null;
}

export interface OnboardedBusiness {
  id: string;
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
  logoUrl: string | null;
}

export type CreateBusinessResponse =
  | { outcome: 'created'; business: OnboardedBusiness }
  | { outcome: 'slug_taken' }
  | { outcome: 'already_onboarded' };

export type ConfirmCheckinResponse =
  | { outcome: 'confirmed'; customer: CustomerSummary; business: BusinessSummary; eligibleForRedemption: boolean }
  | { outcome: 'not_found' };

export type RedeemResponse =
  | { outcome: 'redeemed'; customer: CustomerSummary; business: BusinessSummary; eligibleForRedemption: boolean }
  | { outcome: 'not_eligible' };

export type CheckinStatusResponse =
  | { status: 'pending'; expiresAt: string }
  | {
      status: 'confirmed';
      customer: CheckinStatusCustomer;
      business: BusinessSummary;
      eligibleForRedemption: boolean;
    }
  | { status: 'expired' }
  | { status: 'not_found' };

export async function getBusiness(slug: string): Promise<BusinessSummary | null> {
  const response = await fetch(`${API_URL}/businesses/${slug}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load business (${response.status})`);
  return response.json();
}

export async function createPendingCheckin(
  slug: string,
  phone: string,
  smsConsent: boolean,
): Promise<{ id: string; expiresAt: string; hasSmsConsent: boolean }> {
  const response = await fetch(`${API_URL}/businesses/${slug}/pending-checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, smsConsent }),
  });
  if (!response.ok) throw new Error(`Failed to check in (${response.status})`);
  return response.json();
}

export async function getCheckinStatus(pendingCheckinId: string): Promise<CheckinStatusResponse> {
  const response = await fetch(`${API_URL}/pending-checkins/${pendingCheckinId}/status`);
  if (response.status === 404) return { status: 'not_found' };
  if (!response.ok) throw new Error(`Failed to load status (${response.status})`);
  return response.json();
}

export async function getMe(): Promise<MeResponse | null> {
  const response = await fetch(`${API_URL}/me`, { headers: await authHeaders() });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Failed to load session (${response.status})`);
  return response.json();
}

export async function getPendingCheckins(slug: string): Promise<QueuedPendingCheckin[]> {
  const response = await fetch(`${API_URL}/businesses/${slug}/pending-checkins`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(`Failed to load queue (${response.status})`);
  return response.json();
}

export interface BusinessStats {
  checkins: number;
  newCustomers: number;
  rewards: number;
  /** The trailing window the counts cover — the UI label reads "Past N days". */
  windowDays: number;
}

export async function getBusinessStats(slug: string): Promise<BusinessStats> {
  const response = await fetch(`${API_URL}/businesses/${slug}/stats`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(`Failed to load stats (${response.status})`);
  return response.json();
}

export async function getCustomers(
  slug: string,
  params: { page: number; sort: CustomerSortField; dir: SortDirection },
): Promise<RosterPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    sort: params.sort,
    dir: params.dir,
  });
  const response = await fetch(`${API_URL}/businesses/${slug}/customers?${query}`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(`Failed to load customers (${response.status})`);
  return response.json();
}

// Returns a Blob rather than a URL the browser can navigate to directly —
// auth here is a Bearer header, which a plain <a href> can't send. The
// caller turns this into a download via a temporary object URL.
export async function exportCustomersCsv(slug: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/businesses/${slug}/customers/export`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(`Failed to export customers (${response.status})`);
  return response.blob();
}

export async function confirmCheckin(pendingCheckinId: string): Promise<ConfirmCheckinResponse> {
  const response = await fetch(`${API_URL}/pending-checkins/${pendingCheckinId}/confirm`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (response.status === 404) return { outcome: 'not_found' };
  if (!response.ok) throw new Error(`Failed to confirm (${response.status})`);
  return response.json();
}

export async function redeem(customerId: string): Promise<RedeemResponse> {
  const response = await fetch(`${API_URL}/customers/${customerId}/redeem`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (response.status === 409) return { outcome: 'not_eligible' };
  if (!response.ok) throw new Error(`Failed to redeem (${response.status})`);
  return response.json();
}

export async function createBusiness(input: {
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
  logoUrl: string | null;
}): Promise<CreateBusinessResponse> {
  const response = await fetch(`${API_URL}/businesses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(input),
  });
  if (response.status === 409) {
    const body = await response.json();
    return { outcome: body.error };
  }
  if (!response.ok) throw new Error(`Failed to create business (${response.status})`);
  return response.json();
}

export async function updateBusiness(
  slug: string,
  input: { name: string; rewardThreshold: number; rewardDescription: string; logoUrl: string | null },
): Promise<OnboardedBusiness> {
  const response = await fetch(`${API_URL}/businesses/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Failed to update business (${response.status})`);
  return response.json();
}

export type StaffRole = 'owner' | 'staff';

export interface StaffRosterEntry {
  id: string;
  role: StaffRole;
  deactivatedAt: string | null;
  // Owner-only — absent entirely for a non-owner caller.
  email?: string;
}

export interface PendingInvite {
  id: string;
  role: StaffRole;
  createdAt: string;
  expiresAt: string;
}

export interface StaffRosterResponse {
  staff: StaffRosterEntry[];
  // Owner-only — absent entirely for a non-owner caller.
  pendingInvites?: PendingInvite[];
}

export async function getStaffRoster(slug: string): Promise<StaffRosterResponse> {
  const response = await fetch(`${API_URL}/businesses/${slug}/staff`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(`Failed to load staff (${response.status})`);
  return response.json();
}

export interface CreatedInvite {
  id: string;
  code: string;
  expiresAt: string;
}

export async function createInvite(slug: string, role: StaffRole): Promise<CreatedInvite> {
  const response = await fetch(`${API_URL}/businesses/${slug}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error(`Failed to create invite (${response.status})`);
  return response.json();
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const response = await fetch(`${API_URL}/invites/${inviteId}/revoke`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  // 404 = already gone (used, expired, or revoked) — the caller's intent is
  // satisfied either way, so don't treat it as an error.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to revoke invite (${response.status})`);
  }
}

export type DeactivateStaffResponse = { outcome: 'deactivated' } | { outcome: 'last_owner' };

export async function deactivateStaffMember(staffId: string): Promise<DeactivateStaffResponse> {
  const response = await fetch(`${API_URL}/staff/${staffId}/deactivate`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (response.status === 409) return { outcome: 'last_owner' };
  if (!response.ok) throw new Error(`Failed to deactivate staff member (${response.status})`);
  return response.json();
}

export type RedeemInviteResponse =
  | { outcome: 'redeemed'; businessId: string; role: StaffRole }
  | { outcome: 'invalid_code' }
  | { outcome: 'already_staff' };

export async function redeemInvite(code: string): Promise<RedeemInviteResponse> {
  const response = await fetch(`${API_URL}/invites/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ code }),
  });
  if (response.status === 400) return { outcome: 'invalid_code' };
  if (response.status === 409) return { outcome: 'already_staff' };
  if (!response.ok) throw new Error(`Failed to redeem invite (${response.status})`);
  return response.json();
}
