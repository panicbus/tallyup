import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { createBusiness, getMe, redeemInvite } from '../lib/api';
import type { OnboardedBusiness } from '../lib/api';
import { OnboardingForm, type OnboardingFormValues } from '../components/OnboardingForm';
import { JoinWithCodeForm } from '../components/JoinWithCodeForm';

type Phase = { name: 'form' } | { name: 'submitting' } | { name: 'complete'; business: OnboardedBusiness };
type Mode = 'create' | 'join';

export function Onboarding() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('create');
  const [phase, setPhase] = useState<Phase>({ name: 'form' });
  const [error, setError] = useState<string | undefined>();
  const [slugError, setSlugError] = useState<string | undefined>();
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [joinError, setJoinError] = useState<string | undefined>();
  const qrRef = useRef<SVGSVGElement>(null);

  async function handleSubmit(values: OnboardingFormValues) {
    setPhase({ name: 'submitting' });
    setError(undefined);
    setSlugError(undefined);

    try {
      const result = await createBusiness(values);

      if (result.outcome === 'slug_taken') {
        setSlugError('That URL is already taken. Pick another.');
        setPhase({ name: 'form' });
        return;
      }
      if (result.outcome === 'already_onboarded') {
        setError('This account is already linked to a business.');
        setPhase({ name: 'form' });
        return;
      }

      setPhase({ name: 'complete', business: result.business });
    } catch {
      setError('Could not create your shop. Try again.');
      setPhase({ name: 'form' });
    }
  }

  async function handleJoinSubmit(code: string) {
    setJoinSubmitting(true);
    setJoinError(undefined);

    try {
      const result = await redeemInvite(code);

      if (result.outcome === 'invalid_code') {
        setJoinError('That code is invalid or has expired.');
        setJoinSubmitting(false);
        return;
      }
      if (result.outcome === 'already_staff') {
        setJoinError('This account is already linked to a business.');
        setJoinSubmitting(false);
        return;
      }

      const me = await getMe();
      if (!me) {
        setJoinError('Joined, but could not load your account. Try signing in again.');
        setJoinSubmitting(false);
        return;
      }
      navigate(`/dashboard/${me.business.slug}`);
    } catch {
      setJoinError('Could not join. Try again.');
      setJoinSubmitting(false);
    }
  }

  function handleSaveQr(slug: string) {
    const svg = qrRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(svgUrl);
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${slug}-qr.png`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      }, 'image/png');
    };
    img.src = svgUrl;
  }

  if (phase.name === 'complete') {
    const { business } = phase;
    const checkinUrl = `${window.location.host}/checkin/${business.slug}`;
    return (
      <div className="page">
        <div className="page-content" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="tag tag-accent-2">You're ready</div>
          <h2 style={{ margin: 0 }}>{business.name}</h2>
          <div
            className="elev-md"
            style={{
              width: 180,
              height: 180,
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '8px solid #fff',
              background: '#fff',
            }}
          >
            <QRCodeSVG ref={qrRef} value={`${window.location.origin}/checkin/${business.slug}`} size={164} />
          </div>
          <p style={{ fontFamily: 'ui-monospace, monospace', margin: 0 }}>{checkinUrl}</p>
          <p className="text-muted" style={{ margin: 0, maxWidth: 280 }}>
            Print this and tape it by the till.
            <br />
            Scan to collect points.
          </p>
          <button
            type="button"
            onClick={() => handleSaveQr(business.slug)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              color: 'var(--color-accent-700)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Download size={14} /> Save QR to photos
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 4 }}
            onClick={() => navigate(`/dashboard/${business.slug}`)}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-content">
        <div>
          <h2 style={{ margin: '0 0 4px' }}>{mode === 'create' ? 'Set up your shop' : 'Join a shop'}</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            {mode === 'create' ? "Take your time, nothing's final until you save." : 'Enter the code your owner sent you.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={mode === 'create' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setMode('create')}
          >
            Create a shop
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setMode('join')}
          >
            Join with a code
          </button>
        </div>

        {mode === 'create' ? (
          <OnboardingForm
            onSubmit={handleSubmit}
            submitting={phase.name === 'submitting'}
            error={error}
            slugError={slugError}
          />
        ) : (
          <JoinWithCodeForm onSubmit={handleJoinSubmit} submitting={joinSubmitting} error={joinError} />
        )}
      </div>
    </div>
  );
}
