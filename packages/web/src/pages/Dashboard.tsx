import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { confirmCheckin, getMe, getPendingCheckins, redeem } from '../lib/api';
import type { MeResponse, QueuedPendingCheckin } from '../lib/api';
import { supabaseClient } from '../lib/supabase';
import { PendingCheckinRow } from '../components/PendingCheckinRow';
import { ResultCard, type ResultCardData } from '../components/ResultCard';

const POLL_INTERVAL_MS = 3000;
const RESULT_CARD_TTL_MS = 30_000;

interface TimedResult extends ResultCardData {
  expiresAt: number;
}

export function Dashboard() {
  const { slug } = useParams() as { slug: string };
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [queue, setQueue] = useState<QueuedPendingCheckin[]>([]);
  const [results, setResults] = useState<TimedResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe().then((result) => {
      if (!result) {
        navigate('/login');
        return;
      }
      if (result.business.slug !== slug) {
        navigate(`/dashboard/${result.business.slug}`);
        return;
      }
      setMe(result);
    });
  }, [slug, navigate]);

  useEffect(() => {
    if (!me) return;
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
  }, [slug, me]);

  async function handleSignOut() {
    await supabaseClient.auth.signOut();
    navigate('/login');
  }

  async function handleConfirm(pendingCheckinId: string) {
    const result = await confirmCheckin(pendingCheckinId);
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
    const result = await redeem(customerId);

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

  if (!me) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Staff dashboard</h1>
      {error && <p role="alert">{error}</p>}
      <p>
        Signed in as {me.email}{' '}
        <Link to={`/dashboard/${slug}/settings`}>Settings</Link>{' '}
        <button type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </p>

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
                confirmDisabled={false}
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
                redeemDisabled={false}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
