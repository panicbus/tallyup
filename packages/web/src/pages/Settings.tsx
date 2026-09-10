import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, QrCode, X } from 'lucide-react';
import { getMe, updateBusiness, updateMyName } from '../lib/api';
import type { MeResponse } from '../lib/api';
import { supabaseClient } from '../lib/supabase';
import { SettingsForm, type SettingsFormValues } from '../components/SettingsForm';
import { CheckInQrCode } from '../components/CheckInQrCode';
import { StaffHeader } from '../components/StaffHeader';

type Mode = 'view' | 'edit';

// A text button that reads as a link — used for the "edit name" / "Back to
// settings" affordances.
const linkButtonStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--color-accent-700)',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
} as const;

export function Settings() {
  const { slug } = useParams() as { slug: string };
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
      setNameInput(result.name ?? '');
    });
  }, [slug, navigate]);

  // The "Saved" confirmation is transient — clear it after 5s (or if the
  // component unmounts / another save starts first).
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 5000);
    return () => clearTimeout(timer);
  }, [saved]);

  // Same transient-confirmation pattern for the name field's own status.
  useEffect(() => {
    if (nameStatus !== 'saved') return;
    const timer = setTimeout(() => setNameStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [nameStatus]);

  useEffect(() => {
    if (!qrOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setQrOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [qrOpen]);

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

  async function handleSaveName() {
    if (!me) return;
    setNameStatus('saving');
    try {
      const updated = await updateMyName(nameInput.trim());
      setMe(updated);
      setNameInput(updated.name ?? '');
      setNameStatus('saved');
    } catch {
      setNameStatus('error');
    }
  }

  function enterEditMode() {
    if (!me) return;
    setSaved(false);
    setNameStatus('idle');
    setNameInput(me.name ?? '');
    setMode('edit');
  }

  function backToSettings() {
    setNameInput(me?.name ?? '');
    setNameStatus('idle');
    setMode('view');
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

        <div className="page-content app-content" style={{ maxWidth: 'none' }}>
          {mode === 'edit' ? (
            <>
              <button type="button" onClick={backToSettings} style={{ ...linkButtonStyle, fontSize: 13, alignSelf: 'flex-start' }}>
                &larr; Back to settings
              </button>

              <div className="field">
                <label htmlFor="first-name">First name</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="first-name"
                    className="input"
                    placeholder="First name"
                    maxLength={60}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={nameStatus === 'saving' || nameInput.trim() === (me.name ?? '')}
                    onClick={handleSaveName}
                  >
                    {nameStatus === 'saving' ? 'Saving…' : nameStatus === 'saved' ? 'Saved' : 'Save'}
                  </button>
                </div>
                {nameStatus === 'error' ? (
                  <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-accent-700)' }}>
                    Could not save your name. Try again.
                  </p>
                ) : (
                  <p className="text-muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                    Shown to your team instead of your email once set.
                  </p>
                )}
              </div>

              {me.role === 'owner' && (
                <SettingsForm
                  business={me.business}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  saved={saved}
                  error={error}
                />
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>Settings</h2>
                {/* Only owners can change the business settings; staff get a
                    read-only view. The API enforces it too (requireOwner on
                    PATCH). Staff still edit their own name via the link below. */}
                {me.role === 'owner' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={enterEditMode}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="field-grid-2">
                  <div className="field">
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>Business name</div>
                    <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-text)' }}>{me.business.name}</div>
                  </div>
                  <div className="field">
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>Punches needed</div>
                    <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-text)' }}>
                      {me.business.rewardThreshold}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>
                    Reward, in your words
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-text)' }}>
                    {me.business.rewardDescription}
                  </div>
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
                    <div style={{ fontSize: 17, color: 'var(--color-neutral-500)' }}>Not set</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 8 }}>
                    Check-in QR code
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setQrOpen(true)}
                  >
                    <QrCode size={14} /> Show printable QR code
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: '1px solid var(--color-divider)',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 4 }}>First name</div>
                  {me.name ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text)' }}>{me.name}</span>
                      <button type="button" onClick={enterEditMode} style={{ ...linkButtonStyle, fontSize: 13 }}>
                        edit name
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={enterEditMode} style={{ ...linkButtonStyle, fontSize: 14 }}>
                      Add first name
                    </button>
                  )}
                </div>

                <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                  Signed in under: {me.email}
                </p>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {qrOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Check-in QR code"
          onClick={() => setQrOpen(false)}
        >
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setQrOpen(false)}>
              <X size={18} />
            </button>
            <CheckInQrCode slug={me.business.slug} size={208} />
          </div>
        </div>
      )}
    </div>
  );
}
