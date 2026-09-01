import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { getMe, updateBusiness } from '../lib/api';
import type { MeResponse } from '../lib/api';
import { supabaseClient } from '../lib/supabase';
import { SettingsForm, type SettingsFormValues } from '../components/SettingsForm';

type Mode = 'view' | 'edit';

export function Settings() {
  const { slug } = useParams() as { slug: string };
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMe().then((result) => {
      if (!result) {
        navigate('/login');
        return;
      }
      if (result.business.slug !== slug) {
        navigate(`/dashboard/${result.business.slug}/settings`);
        return;
      }
      setMe(result);
    });
  }, [slug, navigate]);

  async function handleSubmit(values: SettingsFormValues) {
    setSubmitting(true);
    setError(undefined);
    setSaved(false);

    try {
      const updated = await updateBusiness(slug, values);
      setMe((current) => (current ? { ...current, business: updated } : current));
      setSaved(true);
    } catch {
      setError('Could not save changes.');
    } finally {
      setSubmitting(false);
    }
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
        <div className="page-content app-content" style={{ maxWidth: 'none' }}>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/${slug}`)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-accent-700)',
              fontSize: 13,
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            ← Back to queue
          </button>

          {mode === 'view' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>Settings</h2>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    setSaved(false);
                    setMode('edit');
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="field-grid-2">
                  <div className="field">
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>Business name</div>
                    <div style={{ fontSize: 15, color: 'var(--color-neutral-500)' }}>{me.business.name}</div>
                  </div>
                  <div className="field">
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>Punches needed</div>
                    <div style={{ fontSize: 15 }}>{me.business.rewardThreshold}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>
                    Reward, in your words
                  </div>
                  <div style={{ fontSize: 15 }}>{me.business.rewardDescription}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>Business logo</div>
                  {me.business.logoUrl ? (
                    <img
                      src={me.business.logoUrl}
                      alt="Business logo"
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        objectFit: 'cover',
                        background: 'var(--color-surface)',
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 15, color: 'var(--color-neutral-500)' }}>Not set</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>Check-in URL</div>
                  <div style={{ fontSize: 15, fontFamily: 'ui-monospace, monospace', color: 'var(--color-neutral-500)' }}>
                    {window.location.host}/checkin/{me.business.slug}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                Sign out
              </button>
            </>
          ) : (
            <SettingsForm
              business={me.business}
              onSubmit={handleSubmit}
              submitting={submitting}
              saved={saved}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
