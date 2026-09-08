import type { CheckInPort, CheckinStatusResult } from '../data-access/check-in-port.js';
import { isEligibleForRedemption } from './eligibility.js';

export type CheckinStatusServiceResult =
  | (Extract<CheckinStatusResult, { status: 'confirmed' }> & { eligibleForRedemption: boolean })
  | { status: 'pending'; expiresAt: Date }
  | { status: 'expired' }
  | { status: 'not_found' };

/**
 * Public, unauthenticated status poll for the customer's own check-in.
 * Still derives eligibility the same way confirmCheckin's service does, so
 * the card can show reward status. The port already narrows the confirmed
 * customer shape (no phone) and time-bounds how long `confirmed` is
 * reported at all — see CheckinStatusCustomer and
 * CONFIRMED_STATUS_VISIBILITY_MS — since pending-checkin rows are never
 * deleted and this endpoint has no auth to otherwise limit who can poll it.
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
