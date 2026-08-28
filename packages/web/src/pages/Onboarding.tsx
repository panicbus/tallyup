import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { createBusiness } from '../lib/api';
import type { OnboardedBusiness } from '../lib/api';
import { OnboardingForm, type OnboardingFormValues } from '../components/OnboardingForm';

type Phase = { name: 'form' } | { name: 'submitting' } | { name: 'complete'; business: OnboardedBusiness };

export function Onboarding() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ name: 'form' });
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(values: OnboardingFormValues) {
    setPhase({ name: 'submitting' });
    setError(undefined);

    const result = await createBusiness(values);

    if (result.outcome === 'slug_taken') {
      setError('That check-in URL is already taken — please choose another.');
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

  if (phase.name === 'complete') {
    const checkinUrl = `${window.location.origin}/checkin/${phase.business.slug}`;
    return (
      <main>
        <h1>{phase.business.name} is ready</h1>
        <p>Print this and post it at checkout — customers scan it to check in.</p>
        <QRCodeSVG value={checkinUrl} size={240} />
        <p>{checkinUrl}</p>
        <button type="button" onClick={() => navigate(`/dashboard/${phase.business.slug}`)}>
          Go to dashboard
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>Create your business</h1>
      <OnboardingForm onSubmit={handleSubmit} submitting={phase.name === 'submitting'} error={error} />
    </main>
  );
}
