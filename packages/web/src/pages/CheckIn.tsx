import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SearchX, Clock } from 'lucide-react';
import { createPendingCheckin, getBusiness, getCheckinStatus } from '../lib/api';
import type { BusinessSummary } from '../lib/api';
import { CheckInForm } from '../components/CheckInForm';
import { CustomerCard } from '../components/CustomerCard';

const STATUS_POLL_INTERVAL_MS = 2000;

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

  async function handleSubmit(phone: string) {
    setPhase({ name: 'submitting' });
    const pending = await createPendingCheckin(slug, phone);
    setPhase({ name: 'waiting', pendingCheckinId: pending.id });
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
            <h1 style={{ fontSize: 32 }}>{business!.name}</h1>
            <div className="tag tag-accent-2" style={{ fontSize: 14, padding: '6px 14px' }}>
              Check in
            </div>
            <p style={{ opacity: 0.75, margin: 0, fontSize: 14 }}>
              Earn <strong>{business!.rewardDescription}</strong> after {business!.rewardThreshold}{' '}
              visit{business!.rewardThreshold === 1 ? '' : 's'}.
            </p>
            <CheckInForm onSubmit={handleSubmit} submitting={phase.name === 'submitting'} />
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <CustomerCard
              businessName={business!.name}
              points={phase.points}
              rewardThreshold={business!.rewardThreshold}
              rewardDescription={business!.rewardDescription}
              eligibleForRedemption={phase.eligibleForRedemption}
            />
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
            <h2 style={{ fontSize: 20, margin: 0 }}>That check-in expired</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: 13, maxWidth: 220 }}>
              Nobody confirmed within 20 minutes. No points were lost.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 4 }}
              onClick={() => setPhase({ name: 'form' })}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
