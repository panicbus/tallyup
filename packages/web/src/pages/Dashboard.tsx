import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { confirmCheckin, getBusinessStats, getMe, getPendingCheckins, redeem } from '../lib/api';
import type { BusinessStats, MeResponse, QueuedPendingCheckin } from '../lib/api';
import { supabaseClient } from '../lib/supabase';
import { PendingCheckinRow } from '../components/PendingCheckinRow';
import { ResultCard, type ResultCardData } from '../components/ResultCard';
import { StaffHeader } from '../components/StaffHeader';
import { StatStrip } from '../components/StatStrip';
import { CheckInQrCode } from '../components/CheckInQrCode';

const POLL_INTERVAL_MS = 3000;
const CLOCK_TICK_MS = 1000;

export function Dashboard() {
  const { slug } = useParams() as { slug: string };
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [queue, setQueue] = useState<QueuedPendingCheckin[]>([]);
  // Confirmed check-ins stay on screen until staff clears them (no timed
  // removal). Newest first.
  const [results, setResults] = useState<ResultCardData[]>([]);
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Stats change on the scale of visits, not seconds — fetched on load and
  // after each confirm/redeem, never on the queue poll.
  const refreshStats = useCallback(() => {
    getBusinessStats(slug)
      .then(setStats)
      .catch(() => {
        /* a missing stats strip isn't worth surfacing an error for */
      });
  }, [slug]);

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
      refreshStats();
    });
  }, [slug, navigate, refreshStats]);

  // Ticks independently of the data poll so wait times count up smoothly
  // instead of jumping in 3-second steps.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(tick);
  }, []);

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
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug, me]);

  async function handleConfirm(pendingCheckinId: string) {
    const result = await confirmCheckin(pendingCheckinId);
    setQueue((current) => current.filter((item) => item.id !== pendingCheckinId));
    refreshStats();

    if (result.outcome === 'confirmed') {
      setResults((current) => [
        {
          id: crypto.randomUUID(),
          customerId: result.customer.id,
          maskedPhone: result.customer.maskedPhone,
          points: result.customer.points,
          rewardThreshold: result.business.rewardThreshold,
          rewardDescription: result.business.rewardDescription,
          eligibleForRedemption: result.eligibleForRedemption,
        },
        ...current,
      ]);
    }
  }

  async function handleRedeem(customerId: string) {
    const result = await redeem(customerId);
    refreshStats();

    if (result.outcome === 'redeemed') {
      setResults((current) =>
        current.map((r) =>
          r.customerId === customerId
            ? {
                ...r,
                points: result.customer.points,
                eligibleForRedemption: result.eligibleForRedemption,
                redeemed: true,
              }
            : r,
        ),
      );
    }
  }

  function handleDismiss(id: string) {
    setResults((current) => current.filter((r) => r.id !== id));
  }

  async function handleSignOut() {
    await supabaseClient.auth.signOut();
    navigate('/login');
  }

  if (!me) {
    return (
      <div className="page">
        <div className="page-content" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="app-shell" style={{ width: '100%', maxWidth: 'var(--page-max-width)' }}>
        <StaffHeader
          slug={slug}
          businessName={me.business.name}
          logoUrl={me.business.logoUrl}
          userEmail={me.email}
          userName={me.name}
          userRole={me.role}
          onSignOut={handleSignOut}
        />

        <div className="page-content app-content" style={{ paddingTop: 24, gap: 12, maxWidth: 'none' }}>
        {error && (
          <p role="alert" style={{ color: 'var(--color-accent-700)' }}>
            {error}
          </p>
        )}

        {stats && (
          <StatStrip
            checkins={stats.checkins}
            newCustomers={stats.newCustomers}
            rewards={stats.rewards}
            windowDays={stats.windowDays}
          />
        )}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Check-in results</h3>
              <span className="tag tag-neutral">{results.length}</span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', fontSize: 13 }}
                onClick={() => setResults([])}
              >
                Clear check-in results
              </button>
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxHeight: 'min(52vh, 520px)',
                overflowY: 'auto',
              }}
            >
              {results.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  onRedeem={handleRedeem}
                  onDismiss={handleDismiss}
                  redeemDisabled={false}
                />
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Waiting now</h3>
          <span className="tag tag-neutral">{queue.length}</span>
        </div>

        {queue.length === 0 ? (
          stats && stats.checkins === 0 && stats.newCustomers === 0 && stats.rewards === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '24px 10px',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: 14, maxWidth: 300, color: 'var(--color-neutral-600)' }}>
                No check-ins yet. Print your QR code and put it where customers can see it, by the register or on the
                counter.
              </p>
              <CheckInQrCode slug={slug} businessName={me.business.name} size={150} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '40px 10px',
                color: 'var(--color-neutral-600)',
              }}
            >
              <Inbox size={28} />
              <p style={{ margin: 0, fontSize: 14 }}>All caught up. Nobody's waiting.</p>
            </div>
          )
        ) : (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {queue.map((checkin) => (
              <PendingCheckinRow
                key={checkin.id}
                checkin={checkin}
                onConfirm={handleConfirm}
                confirmDisabled={false}
                now={now}
              />
            ))}
          </ul>
        )}
        </div>
      </div>
    </div>
  );
}
