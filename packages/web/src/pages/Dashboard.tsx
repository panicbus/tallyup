import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { confirmCheckin, getPendingCheckins, getStaff, redeem } from '../lib/api';
import type { QueuedPendingCheckin, StaffMember } from '../lib/api';
import { StaffPicker } from '../components/StaffPicker';
import { PendingCheckinRow } from '../components/PendingCheckinRow';
import { ResultCard, type ResultCardData } from '../components/ResultCard';

const POLL_INTERVAL_MS = 3000;
const RESULT_CARD_TTL_MS = 30_000;

interface TimedResult extends ResultCardData {
  expiresAt: number;
}

export function Dashboard() {
  const { slug } = useParams() as { slug: string };
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [queue, setQueue] = useState<QueuedPendingCheckin[]>([]);
  const [results, setResults] = useState<TimedResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStaff(slug)
      .then((members) => {
        setStaff(members);
        setSelectedStaffId((current) => current || (members[0]?.id ?? ''));
      })
      .catch(() => setError('Could not load staff list.'));
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const items = await getPendingCheckins(slug);
        if (!cancelled) setQueue(items);
      } catch {
        if (!cancelled) setError('Could not load the check-in queue.');
      }
      if (!cancelled) {
        setResults((current) => current.filter((r) => r.expiresAt > Date.now()));
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  async function handleConfirm(pendingCheckinId: string) {
    const result = await confirmCheckin(pendingCheckinId, selectedStaffId);
    setQueue((current) => current.filter((item) => item.id !== pendingCheckinId));

    if (result.outcome === 'confirmed') {
      setResults((current) => [
        ...current,
        {
          customerId: result.customer.id,
          maskedPhone: result.customer.phone,
          points: result.customer.points,
          rewardThreshold: result.business.rewardThreshold,
          eligibleForRedemption: result.eligibleForRedemption,
          expiresAt: Date.now() + RESULT_CARD_TTL_MS,
        },
      ]);
    }
  }

  async function handleRedeem(customerId: string) {
    const result = await redeem(customerId, selectedStaffId);

    if (result.outcome === 'redeemed') {
      setResults((current) =>
        current.map((r) =>
          r.customerId === customerId
            ? {
                ...r,
                points: result.customer.points,
                eligibleForRedemption: result.eligibleForRedemption,
                expiresAt: Date.now() + RESULT_CARD_TTL_MS,
              }
            : r,
        ),
      );
    }
  }

  function handleDismiss(customerId: string) {
    setResults((current) => current.filter((r) => r.customerId !== customerId));
  }

  return (
    <main>
      <h1>Staff dashboard</h1>
      {error && <p role="alert">{error}</p>}
      <StaffPicker staff={staff} selectedId={selectedStaffId} onChange={setSelectedStaffId} />

      <section>
        <h2>Waiting</h2>
        {queue.length === 0 ? (
          <p>No customers waiting.</p>
        ) : (
          <ul>
            {queue.map((checkin) => (
              <PendingCheckinRow
                key={checkin.id}
                checkin={checkin}
                onConfirm={handleConfirm}
                confirmDisabled={!selectedStaffId}
              />
            ))}
          </ul>
        )}
      </section>

      {results.length > 0 && (
        <section>
          <h2>Recently confirmed</h2>
          <ul>
            {results.map((result) => (
              <ResultCard
                key={result.customerId}
                result={result}
                onRedeem={handleRedeem}
                onDismiss={handleDismiss}
                redeemDisabled={!selectedStaffId}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
