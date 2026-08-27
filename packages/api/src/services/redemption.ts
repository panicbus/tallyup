import type { CheckInPort, RedeemResult } from '../data-access/check-in-port.js';
import { isEligibleForRedemption } from './eligibility.js';
import { maskPhone } from './phone-masking.js';

export type RedeemServiceResult =
  | (Extract<RedeemResult, { outcome: 'redeemed' }> & { eligibleForRedemption: boolean })
  | { outcome: 'not_eligible' };

/**
 * Redeems via the port (the atomic guarded update — one redemption per
 * call, even if the remainder still qualifies), then reports whether the
 * remainder is itself still eligible, so the UI knows to offer "redeem
 * again" immediately rather than the customer needing another visit.
 */
export async function redeem(
  port: Pick<CheckInPort, 'redeem'>,
  input: { customerId: string; confirmedBy: string },
): Promise<RedeemServiceResult> {
  const result = await port.redeem(input);

  if (result.outcome === 'not_eligible') {
    return result;
  }

  return {
    ...result,
    customer: { ...result.customer, phone: maskPhone(result.customer.phone) },
    eligibleForRedemption: isEligibleForRedemption(result.customer.points, result.business.rewardThreshold),
  };
}
