import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { phoneSchema } from '@tallyup/shared';
import { lookupCards, type CustomerCard as CustomerCardData } from '../lib/api';
import { CustomerCard } from '../components/CustomerCard';
import { PhoneField } from '../components/PhoneField';
import { forgetRememberedPhone, loadRememberedPhone, rememberPhone } from '../lib/remembered-phone';

type Phase =
  | { name: 'form' }
  | { name: 'looking_up' }
  | { name: 'results'; cards: CustomerCardData[] }
  | { name: 'error' };

export function Card() {
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'form' });

  // Returning to this page (a home-screen icon, a bookmark) looks the
  // number back up immediately, so it works without retyping. Per-device
  // convenience only — nothing about the lookup itself needs this.
  useEffect(() => {
    const remembered = loadRememberedPhone();
    if (!remembered) return;
    setPhase({ name: 'looking_up' });
    lookupCards(remembered)
      .then((cards) => setPhase({ name: 'results', cards }))
      .catch(() => setPhase({ name: 'error' }));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setFieldError("That doesn't look like a full phone number yet.");
      return;
    }
    setFieldError(null);
    setPhase({ name: 'looking_up' });
    try {
      const cards = await lookupCards(parsed.data);
      rememberPhone(parsed.data);
      setPhase({ name: 'results', cards });
    } catch {
      setPhase({ name: 'error' });
    }
  }

  function useDifferentNumber() {
    forgetRememberedPhone();
    setPhone('');
    setFieldError(null);
    setPhase({ name: 'form' });
  }

  return (
    <div className="page">
      <div className="page-content">
        {phase.name === 'looking_up' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 14,
            }}
          >
            <p className="text-muted">Looking up your punch cards…</p>
          </div>
        )}

        {phase.name === 'form' && (
          <>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--color-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
              }}
            >
              <Search size={24} color="var(--color-accent-700)" />
            </div>
            <h1 style={{ fontSize: 26, textAlign: 'center' }}>Check your punches</h1>
            <p className="text-muted" style={{ margin: 0, fontSize: 14, textAlign: 'center' }}>
              Enter the phone number you check in with to see every shop you've earned points at.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <PhoneField value={phone} onChange={setPhone} error={fieldError} autoFocus />
              <button type="submit" className="btn btn-primary btn-block" style={{ fontSize: 16, padding: 16 }}>
                Look up my punches
              </button>
            </form>
            {/* Anyone who knows this number can see its balances (see
                Privacy Policy). Said plainly, right where the number is
                typed, not buried in a policy nobody opens. */}
            <p className="text-muted" style={{ margin: 0, fontSize: 12, textAlign: 'center' }}>
              Anyone who knows this number can look up its punch cards. See our{' '}
              <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </>
        )}

        {phase.name === 'results' && (
          <>
            {phase.cards.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  gap: 10,
                  textAlign: 'center',
                }}
              >
                <h2 style={{ fontSize: 20, margin: 0 }}>No punch cards yet</h2>
                <p className="text-muted" style={{ margin: 0, fontSize: 13, maxWidth: 260 }}>
                  We didn't find any punches for that number. Check in at a shop to start a card.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {phase.cards.map((card) => (
                  <CustomerCard
                    key={card.businessSlug}
                    businessName={card.businessName}
                    points={card.points}
                    rewardThreshold={card.rewardThreshold}
                    rewardDescription={card.rewardDescription}
                    eligibleForRedemption={card.eligibleForRedemption}
                    logoUrl={card.logoUrl}
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={useDifferentNumber}
              className="btn btn-block"
              style={{ fontSize: 14, marginTop: 8 }}
            >
              Use a different number
            </button>
          </>
        )}

        {phase.name === 'error' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 14,
              textAlign: 'center',
            }}
          >
            <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
              Something went wrong loading your punch cards.
            </p>
            <button type="button" onClick={useDifferentNumber} className="btn btn-primary">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
