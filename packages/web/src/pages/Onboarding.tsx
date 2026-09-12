import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBusiness } from '../lib/api';
import type { OnboardedBusiness } from '../lib/api';
import { OnboardingForm, type OnboardingFormValues } from '../components/OnboardingForm';
import { CheckInQrCode } from '../components/CheckInQrCode';

type Phase = { name: 'form' } | { name: 'submitting' } | { name: 'complete'; business: OnboardedBusiness };

export function Onboarding() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ name: 'form' });
  const [error, setError] = useState<string | undefined>();
  const [slugError, setSlugError] = useState<string | undefined>();

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

  if (phase.name === 'complete') {
    const { business } = phase;
    return (
      <div className="page">
        <div className="page-content" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div
            className="tag tag-accent-2"
            style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', padding: '8px 22px' }}
          >
            You're ready
          </div>
          <CheckInQrCode slug={business.slug} businessName={business.name} />
          <p className="text-muted" style={{ margin: 0, maxWidth: 280 }}>
            Print this and tape it by the till.
            <br />
            Scan to collect points.
          </p>
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
            Take your time, nothing's final until you save.
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
