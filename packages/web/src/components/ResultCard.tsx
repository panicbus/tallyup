export interface ResultCardData {
  customerId: string;
  maskedPhone: string;
  points: number;
  rewardThreshold: number;
  eligibleForRedemption: boolean;
}

interface ResultCardProps {
  result: ResultCardData;
  onRedeem: (customerId: string) => void;
  onDismiss: (customerId: string) => void;
  redeemDisabled: boolean;
}

export function ResultCard({ result, onRedeem, onDismiss, redeemDisabled }: ResultCardProps) {
  return (
    <li>
      <span>{result.maskedPhone}</span>
      <span>
        {result.points}/{result.rewardThreshold}
      </span>
      {result.eligibleForRedemption && (
        <button type="button" onClick={() => onRedeem(result.customerId)} disabled={redeemDisabled}>
          Redeem
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={() => onDismiss(result.customerId)}>
        ×
      </button>
    </li>
  );
}
