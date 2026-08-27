export function isEligibleForRedemption(points: number, rewardThreshold: number): boolean {
  return points >= rewardThreshold;
}
