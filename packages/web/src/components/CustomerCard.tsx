interface CustomerCardProps {
  businessName: string;
  points: number;
  rewardThreshold: number;
  rewardDescription: string;
  eligibleForRedemption: boolean;
}

export function CustomerCard({
  businessName,
  points,
  rewardThreshold,
  rewardDescription,
  eligibleForRedemption,
}: CustomerCardProps) {
  const filled = Math.min(points, rewardThreshold);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        textAlign: 'center',
      }}
    >
      <div className={eligibleForRedemption ? 'tag tag-accent' : 'tag tag-accent-2'} style={{ fontSize: 14, padding: '7px 16px' }}>
        {eligibleForRedemption ? <strong>Reward ready!</strong> : 'Your punch card'}
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
        <div
          style={{
            position: 'absolute',
            inset: '7px 0 -7px 0',
            background: 'var(--color-neutral-300)',
            borderRadius: 20,
          }}
        />
        <div
          className="elev-lg"
          style={{
            position: 'relative',
            background: '#fff',
            backgroundImage: eligibleForRedemption
              ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px)'
              : undefined,
            borderRadius: 20,
            padding: 26,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{businessName}</span>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: 18,
                color: 'var(--color-accent-700)',
                whiteSpace: 'nowrap',
              }}
            >
              {points} / {rewardThreshold}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, justifyItems: 'center' }}>
            {Array.from({ length: rewardThreshold }, (_, i) => {
              const isFilled = i < filled;
              return (
                <div
                  key={i}
                  data-dot={isFilled ? 'filled' : 'empty'}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isFilled ? 'var(--color-accent-2-500)' : 'var(--color-neutral-200)',
                    boxShadow: `inset 0 2px 3px rgba(0,0,0,${isFilled ? 0.18 : 0.22})`,
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              borderTop: '1px dashed var(--color-divider)',
              paddingTop: 12,
              fontSize: 14,
              color: 'var(--color-neutral-600)',
              textAlign: 'left',
            }}
          >
            towards <strong style={{ color: 'var(--color-text)' }}>{rewardDescription}</strong>
          </div>
        </div>
      </div>

      {eligibleForRedemption ? (
        <p style={{ fontWeight: 700, margin: 0 }}>Show this screen to staff</p>
      ) : (
        <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
          Come back anytime. Your progress stays right here.
        </p>
      )}
    </div>
  );
}
