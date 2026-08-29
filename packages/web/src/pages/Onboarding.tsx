import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { createBusiness } from '../lib/api';
import type { OnboardedBusiness } from '../lib/api';
import { OnboardingForm, type OnboardingFormValues } from '../components/OnboardingForm';

type Phase = { name: 'form' } | { name: 'submitting' } | { name: 'complete'; business: OnboardedBusiness };

export function Onboarding() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ name: 'form' });
  const [error, setError] = useState<string | undefined>();
  const [slugError, setSlugError] = useState<string | undefined>();
  const qrRef = useRef<SVGSVGElement>(null);

  async function handleSubmit(values: OnboardingFormValues) {
    setPhase({ name: 'submitting' });
    setError(undefined);
    setSlugError(undefined);

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
            Print this and tape it by the till. Scan to collect points.
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
          <h2 style={{ margin: '0 0 4px' }}>Set up your shop</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            This becomes real once you save it — take your time.
          </p>
        </div>
        <OnboardingForm
          onSubmit={handleSubmit}
          submitting={phase.name === 'submitting'}
          error={error}
          slugError={slugError}
        />
      </div>
    </div>
  );
}
