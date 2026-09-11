interface CustomerCardProps {
  businessName: string;
  points: number;
  rewardThreshold: number;
  rewardDescription: string;
  eligibleForRedemption: boolean;
  logoUrl?: string | null;
}

// The punch card itself is a physical object (paper, ink), not a themed UI
// panel — like the QR code's white frame, it looks the same in dark mode as
// in light: light card, dark text, and the logo's green punch dots. These
// are literal light-theme values, not var(--color-*), so they stay fixed
// regardless of the active theme.
const CARD_BACKDROP = '#b1ada5';
const CARD_BG = '#e2e7ef';
const CARD_TEXT = '#1c2230';
const CARD_TEXT_MUTED = '#67635b';
const CARD_ACCENT = '#333c8f';
const CARD_DIVIDER = 'color-mix(in srgb, #1c2230 14%, transparent)';
const CARD_DOT_EMPTY = '#cbc7bf';
const CARD_DOT_FILLED = '#8fa073'; // matches the logo mark's punch dots

export function CustomerCard({
  businessName,
  points,
  rewardThreshold,
  rewardDescription,
  eligibleForRedemption,
  logoUrl,
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
      <div
        className={eligibleForRedemption ? 'tag tag-accent' : 'tag tag-accent-2'}
        style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', padding: '9px 20px' }}
      >
        {eligibleForRedemption ? 'Reward ready!' : 'Your punch card'}
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
        <div
          style={{
            position: 'absolute',
            inset: '7px 0 -7px 0',
            background: CARD_BACKDROP,
            borderRadius: 20,
          }}
        />
        <div
          className="elev-lg"
          style={{
            position: 'relative',
            background: CARD_BG,
            backgroundImage: eligibleForRedemption
              ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px)'
              : undefined,
            borderRadius: 20,
            padding: 26,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            color: CARD_TEXT,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: 18,
                textAlign: 'left',
              }}
            >
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flex: 'none' }}
                />
              )}
              {businessName}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: 18,
                color: CARD_ACCENT,
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
                    background: isFilled ? CARD_DOT_FILLED : CARD_DOT_EMPTY,
                    boxShadow: `inset 0 2px 3px rgba(0,0,0,${isFilled ? 0.18 : 0.22})`,
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              borderTop: `1px dashed ${CARD_DIVIDER}`,
              paddingTop: 12,
              fontSize: 14,
              color: CARD_TEXT_MUTED,
              textAlign: 'left',
            }}
          >
            towards <strong style={{ color: CARD_TEXT }}>{rewardDescription}</strong>
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
