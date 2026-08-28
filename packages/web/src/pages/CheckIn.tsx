import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  if (phase.name === 'not_found') {
    return (
      <main>
        <p>We couldn't find this shop.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{business!.name}</h1>

      {(phase.name === 'form' || phase.name === 'submitting') && (
        <>
          <p>Enter your phone number to check in and earn: {business!.rewardDescription}</p>
          <CheckInForm onSubmit={handleSubmit} submitting={phase.name === 'submitting'} />
        </>
      )}

      {phase.name === 'waiting' && <p>Waiting for staff to confirm your check-in…</p>}

      {phase.name === 'confirmed' && (
        <CustomerCard
          points={phase.points}
          rewardThreshold={business!.rewardThreshold}
          rewardDescription={business!.rewardDescription}
          eligibleForRedemption={phase.eligibleForRedemption}
        />
      )}

      {phase.name === 'expired' && (
        <>
          <p>This check-in expired. Please try again.</p>
          <button type="button" onClick={() => setPhase({ name: 'form' })}>
            Try again
          </button>
        </>
      )}
    </main>
  );
}
