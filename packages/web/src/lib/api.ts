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
  business: { id: string; name: string; slug: string; rewardThreshold: number; rewardDescription: string };
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

export interface BusinessSummary {
  id: string;
  name: string;
  rewardThreshold: number;
  rewardDescription: string;
}

export interface OnboardedBusiness {
  id: string;
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
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
  | { status: 'confirmed'; customer: CustomerSummary; business: BusinessSummary; eligibleForRedemption: boolean }
  | { status: 'expired' }
  | { status: 'not_found' };

export async function getBusiness(slug: string): Promise<BusinessSummary | null> {
  const response = await fetch(`${API_URL}/businesses/${slug}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load business (${response.status})`);
  return response.json();
}

export async function createPendingCheckin(slug: string, phone: string): Promise<{ id: string; expiresAt: string }> {
  const response = await fetch(`${API_URL}/businesses/${slug}/pending-checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
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
  input: { name: string; rewardThreshold: number; rewardDescription: string },
): Promise<OnboardedBusiness> {
  const response = await fetch(`${API_URL}/businesses/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Failed to update business (${response.status})`);
  return response.json();
}
