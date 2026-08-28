import type { CheckInPort, CheckinStatusResult } from '../data-access/check-in-port.js';
import { isEligibleForRedemption } from './eligibility.js';

export type CheckinStatusServiceResult =
  | (Extract<CheckinStatusResult, { status: 'confirmed' }> & { eligibleForRedemption: boolean })
  | { status: 'pending'; expiresAt: Date }
  | { status: 'expired' }
  | { status: 'not_found' };

/**
 * Public, unauthenticated status poll for the customer's own check-in — no
 * masking (it's their own data), but still derives eligibility the same
 * way confirmCheckin's service does, so the card can show reward status.
 */
export async function getCheckinStatus(
  port: Pick<CheckInPort, 'getCheckinStatus'>,
  pendingCheckinId: string,
): Promise<CheckinStatusServiceResult> {
  const result = await port.getCheckinStatus(pendingCheckinId);

  if (result.status !== 'confirmed') {
    return result;
  }

  return {
    ...result,
    eligibleForRedemption: isEligibleForRedemption(result.customer.points, result.business.rewardThreshold),
  };
}
