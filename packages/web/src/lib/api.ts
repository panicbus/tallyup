const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface StaffMember {
  id: string;
  email: string;
  role: string;
}

export interface QueuedPendingCheckin {
  id: string;
  maskedPhone: string;
  createdAt: string;
}

interface CustomerSummary {
  id: string;
  phone: string;
  points: number;
}

interface BusinessSummary {
  id: string;
  rewardThreshold: number;
}

export type ConfirmCheckinResponse =
  | { outcome: 'confirmed'; customer: CustomerSummary; business: BusinessSummary; eligibleForRedemption: boolean }
  | { outcome: 'not_found' };

export type RedeemResponse =
  | { outcome: 'redeemed'; customer: CustomerSummary; business: BusinessSummary; eligibleForRedemption: boolean }
  | { outcome: 'not_eligible' };

export async function getStaff(slug: string): Promise<StaffMember[]> {
  const response = await fetch(`${API_URL}/businesses/${slug}/staff`);
  if (!response.ok) throw new Error(`Failed to load staff (${response.status})`);
  return response.json();
}

export async function getPendingCheckins(slug: string): Promise<QueuedPendingCheckin[]> {
  const response = await fetch(`${API_URL}/businesses/${slug}/pending-checkins`);
  if (!response.ok) throw new Error(`Failed to load queue (${response.status})`);
  return response.json();
}

export async function confirmCheckin(pendingCheckinId: string, confirmedBy: string): Promise<ConfirmCheckinResponse> {
  const response = await fetch(`${API_URL}/pending-checkins/${pendingCheckinId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmedBy }),
  });
  if (response.status === 404) return { outcome: 'not_found' };
  if (!response.ok) throw new Error(`Failed to confirm (${response.status})`);
  return response.json();
}

export async function redeem(customerId: string, confirmedBy: string): Promise<RedeemResponse> {
  const response = await fetch(`${API_URL}/customers/${customerId}/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmedBy }),
  });
  if (response.status === 409) return { outcome: 'not_eligible' };
  if (!response.ok) throw new Error(`Failed to redeem (${response.status})`);
  return response.json();
}
