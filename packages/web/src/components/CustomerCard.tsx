interface CustomerCardProps {
  points: number;
  rewardThreshold: number;
  rewardDescription: string;
  eligibleForRedemption: boolean;
}

export function CustomerCard({ points, rewardThreshold, rewardDescription, eligibleForRedemption }: CustomerCardProps) {
  return (
    <section>
      <p>
        {points}/{rewardThreshold}
      </p>
      <p>Reward: {rewardDescription}</p>
      {eligibleForRedemption && <p>Your reward is ready! Show this screen to staff.</p>}
    </section>
  );
}
