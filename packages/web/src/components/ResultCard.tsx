import { CheckCircle, Gift } from 'lucide-react';

export interface ResultCardData {
  customerId: string;
  maskedPhone: string;
  points: number;
  rewardThreshold: number;
  rewardDescription: string;
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
    <li
      className="tu-fadein"
      style={{
        listStyle: 'none',
        background: 'var(--color-accent-100)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CheckCircle size={18} color="var(--color-accent-700)" />
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>{result.maskedPhone}</span>
        <span style={{ fontWeight: 700, marginLeft: 'auto' }}>
          {result.points} of {result.rewardThreshold}
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => onDismiss(result.customerId)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-neutral-600)',
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      </div>
      {result.eligibleForRedemption && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ fontSize: 16 }}
          onClick={() => onRedeem(result.customerId)}
          disabled={redeemDisabled}
        >
          <Gift size={16} /> Redeem — {result.rewardDescription}
        </button>
      )}
    </li>
  );
}
