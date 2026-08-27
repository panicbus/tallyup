import type { CheckInPort, ConfirmCheckinResult } from '../data-access/check-in-port.js';
import { isEligibleForRedemption } from './eligibility.js';
import { maskPhone } from './phone-masking.js';

export type ConfirmCheckinServiceResult =
  | (Extract<ConfirmCheckinResult, { outcome: 'confirmed' }> & { eligibleForRedemption: boolean })
  | { outcome: 'not_found' };

/**
 * Confirms a pending check-in via the port (the atomic fraud-gate
 * operation), then derives redemption eligibility — pure decision logic
 * that has no business being inside the transaction itself.
 */
export async function confirmCheckin(
  port: Pick<CheckInPort, 'confirmCheckin'>,
  input: { pendingCheckinId: string; confirmedBy: string },
): Promise<ConfirmCheckinServiceResult> {
  const result = await port.confirmCheckin(input);

  if (result.outcome === 'not_found') {
    return result;
  }

  return {
    ...result,
    customer: { ...result.customer, phone: maskPhone(result.customer.phone) },
    eligibleForRedemption: isEligibleForRedemption(result.customer.points, result.business.rewardThreshold),
  };
}

export interface QueuedPendingCheckin {
  id: string;
  maskedPhone: string;
  createdAt: Date;
}

/** The staff dashboard's polling queue — masked, never the raw port shape. */
export async function listPendingCheckins(
  port: Pick<CheckInPort, 'listPendingCheckins'>,
  businessId: string,
): Promise<QueuedPendingCheckin[]> {
  const pendingCheckins = await port.listPendingCheckins(businessId);
  return pendingCheckins.map((p) => ({ id: p.id, maskedPhone: maskPhone(p.phone), createdAt: p.createdAt }));
}
