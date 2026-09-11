import type { CheckInPort, CustomerCardBalance } from '../data-access/check-in-port.js';
import { isEligibleForRedemption } from './eligibility.js';

export type CustomerCard = CustomerCardBalance & { eligibleForRedemption: boolean };

/**
 * Public, unauthenticated phone-number punch-card lookup. Same shape of
 * derivation as getCheckinStatus: the port already narrows what it returns
 * (no phone — see CustomerCardBalance and findCardsByPhone) and this layer
 * only adds eligibility, using the one shared definition of "reward ready."
 */
export async function getCustomerCards(
  port: Pick<CheckInPort, 'findCardsByPhone'>,
  phone: string,
): Promise<CustomerCard[]> {
  const cards = await port.findCardsByPhone(phone);

  return cards.map((card) => ({
    ...card,
    eligibleForRedemption: isEligibleForRedemption(card.points, card.rewardThreshold),
  }));
}
