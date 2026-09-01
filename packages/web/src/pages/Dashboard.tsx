import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Inbox, Settings as SettingsIcon } from 'lucide-react';
import { confirmCheckin, getMe, getPendingCheckins, redeem } from '../lib/api';
import type { MeResponse, QueuedPendingCheckin } from '../lib/api';
import { supabaseClient } from '../lib/supabase';
import { PendingCheckinRow } from '../components/PendingCheckinRow';
import { ResultCard, type ResultCardData } from '../components/ResultCard';

const POLL_INTERVAL_MS = 3000;
const CLOCK_TICK_MS = 1000;
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
  const [now, setNow] = useState(() => Date.now());

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
          rewardDescription: result.business.rewardDescription,
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
        <div
          className="app-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-divider)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              flex: 'none',
              overflow: 'hidden',
              background: 'var(--color-surface)',
              border: me.business.logoUrl ? 'none' : '1px dashed var(--color-neutral-400)',
            }}
          >
            {me.business.logoUrl && (
              <img
                src={me.business.logoUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{me.business.name}</div>

          <div className="nav-tabs">
            <Link to={`/dashboard/${slug}`} className="nav-tab" aria-current="page">
              Dashboard
            </Link>
            <Link to={`/dashboard/${slug}/settings`} className="nav-tab">
              Settings
            </Link>
          </div>

          <div className="text-muted staff-signed-in-mobile" style={{ marginLeft: 'auto', fontSize: 12 }}>
            Staff · signed in
          </div>
          <Link
            to={`/dashboard/${slug}/settings`}
            aria-label="Settings"
            className="settings-icon-mobile"
            style={{ color: 'var(--color-neutral-600)', padding: 4, display: 'flex' }}
          >
            <SettingsIcon size={18} />
          </Link>
          <button type="button" onClick={handleSignOut} className="sign-out-desktop">
            Sign out
          </button>
        </div>

        <div className="page-content app-content" style={{ paddingTop: 24, gap: 12, maxWidth: 'none' }}>
        {error && (
          <p role="alert" style={{ color: 'var(--color-accent-700)' }}>
            {error}
          </p>
        )}

        {results.length > 0 && (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Waiting now</h3>
          <span className="tag tag-neutral">{queue.length}</span>
        </div>

        {queue.length === 0 ? (
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
            <p style={{ margin: 0, fontSize: 14 }}>All caught up — nobody's waiting.</p>
          </div>
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
