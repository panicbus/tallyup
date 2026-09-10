import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SearchX, Clock } from 'lucide-react';
import { normalizePhone } from '@tallyup/shared';
import { createPendingCheckin, getBusiness, getCheckinStatus } from '../lib/api';
import type { BusinessSummary } from '../lib/api';
import { CheckInForm } from '../components/CheckInForm';
import { CustomerCard } from '../components/CustomerCard';

const STATUS_POLL_INTERVAL_MS = 2000;

// Which phone numbers (E.164) this device has seen opt into SMS at this
// shop, so a returning customer isn't shown the consent checkbox again.
// Per-device convenience only; the server's ledger is the real record.
function consentStorageKey(slug: string): string {
  return `tallyup:sms-consent:${slug}`;
}
function loadConsentedPhones(slug: string): Set<string> {
  try {
    const raw = localStorage.getItem(consentStorageKey(slug));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function persistConsentedPhones(slug: string, phones: Set<string>): void {
  try {
    localStorage.setItem(consentStorageKey(slug), JSON.stringify([...phones]));
  } catch {
    // Private mode / storage disabled. The in-memory Set still works for
    // this session, which is the common case anyway.
  }
}

type Phase =
  | { name: 'loading' }
  | { name: 'not_found' }
  | { name: 'form' }
  | { name: 'submitting' }
  | { name: 'waiting'; pendingCheckinId: string }
  | { name: 'confirmed'; points: number; eligibleForRedemption: boolean }
  | { name: 'expired' };

export function CheckIn() {
  const { slug } = useParams() as { slug: string };
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [consentedPhones, setConsentedPhones] = useState<Set<string>>(() => loadConsentedPhones(slug));

  useEffect(() => {
    getBusiness(slug).then((found) => {
      setBusiness(found);
      setPhase(found ? { name: 'form' } : { name: 'not_found' });
    });
  }, [slug]);

  useEffect(() => {
    if (phase.name !== 'waiting') return;
    const pendingCheckinId = phase.pendingCheckinId;
    let cancelled = false;

    async function poll() {
      const status = await getCheckinStatus(pendingCheckinId);
      if (cancelled) return;

      if (status.status === 'confirmed') {
        setPhase({ name: 'confirmed', points: status.customer.points, eligibleForRedemption: status.eligibleForRedemption });
      } else if (status.status === 'expired' || status.status === 'not_found') {
        setPhase({ name: 'expired' });
      }
    }

    poll();
    const interval = setInterval(poll, STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase]);

  async function handleSubmit(phone: string, smsConsent: boolean) {
    setPhase({ name: 'submitting' });
    const pending = await createPendingCheckin(slug, phone, smsConsent);

    if (pending.hasSmsConsent) {
      const e164 = normalizePhone(phone);
      if (e164) {
        setConsentedPhones((current) => {
          const next = new Set(current).add(e164);
          persistConsentedPhones(slug, next);
          return next;
        });
      }
    }

    setPhase({ name: 'waiting', pendingCheckinId: pending.id });
  }

  function isPhoneKnownConsented(phone: string): boolean {
    const e164 = normalizePhone(phone);
    return e164 != null && consentedPhones.has(e164);
  }

  if (phase.name === 'loading') {
    return (
      <div className="page">
        <div className="page-content" style={{ justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (phase.name === 'not_found') {
    return (
      <div className="page">
        <div
          className="page-content"
          style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', flex: 1, gap: 14 }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--color-neutral-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SearchX size={24} color="var(--color-neutral-600)" />
          </div>
          <h2 style={{ fontSize: 20, margin: 0 }}>We can't find that shop</h2>
          <p className="text-muted" style={{ margin: 0, fontSize: 13, maxWidth: 220 }}>
            Double-check the link or QR code. It may be mistyped.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-content">
        {(phase.name === 'form' || phase.name === 'submitting') && (
          <>
            {business!.logoUrl && (
              <img
                src={business!.logoUrl}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  objectFit: 'cover',
                  alignSelf: 'center',
                  background: 'var(--color-surface)',
                }}
              />
            )}
            <h1 style={{ fontSize: 32 }}>{business!.name}</h1>
            <div className="tag tag-accent-2" style={{ fontSize: 14, padding: '6px 14px' }}>
              Check in
            </div>
            <p style={{ opacity: 0.75, margin: 0, fontSize: 14 }}>
              Earn <strong>{business!.rewardDescription}</strong> after {business!.rewardThreshold}{' '}
              visit{business!.rewardThreshold === 1 ? '' : 's'}.
            </p>
            <CheckInForm
              onSubmit={handleSubmit}
              submitting={phase.name === 'submitting'}
              businessName={business!.name}
              isPhoneKnownConsented={isPhoneKnownConsented}
            />
          </>
        )}

        {phase.name === 'waiting' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 16,
              textAlign: 'center',
            }}
          >
            <div
              className="tu-pulse"
              style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-accent)' }}
            />
            <h2 style={{ fontSize: 21, margin: 0 }}>Waiting for staff…</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: 14, maxWidth: 220 }}>
              This screen updates on its own.
              <br />
              No need to refresh.
            </p>
          </div>
        )}

        {phase.name === 'confirmed' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            <CustomerCard
              businessName={business!.name}
              points={phase.points}
              rewardThreshold={business!.rewardThreshold}
              rewardDescription={business!.rewardDescription}
              eligibleForRedemption={phase.eligibleForRedemption}
              logoUrl={business!.logoUrl}
            />
            <p className="text-muted" style={{ margin: 0, fontSize: 13, textAlign: 'center' }}>
              Scan the code again on your next visit.
            </p>
          </div>
        )}

        {phase.name === 'expired' && (
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
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--color-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={24} color="var(--color-accent-700)" />
            </div>
            <h2 style={{ fontSize: 20, margin: 0 }}>Check-in expired</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: 13, maxWidth: 240 }}>
              Nobody confirmed within 20 minutes. No points were lost. Scan the code again to check in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
