import type { CheckInPort, ConfirmCheckinResult } from '../data-access/check-in-port.js';
import { isEligibleForRedemption } from './eligibility.js';

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
    eligibleForRedemption: isEligibleForRedemption(result.customer.points, result.business.rewardThreshold),
  };
}
