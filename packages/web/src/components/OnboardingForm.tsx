import { useState, type FormEvent } from 'react';
import { slugify } from '@tallyup/shared';
import { LogoPicker } from './LogoPicker';

export interface OnboardingFormValues {
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
}

interface OnboardingFormProps {
  onSubmit: (values: OnboardingFormValues) => void;
  submitting: boolean;
  /** General, not tied to a field — e.g. this account already owns a business. */
  error?: string;
  /** Replaces the check-in URL field's normal permanence hint. */
  slugError?: string;
}

export function OnboardingForm({ onSubmit, submitting, error, slugError }: OnboardingFormProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [rewardThreshold, setRewardThreshold] = useState('10');
  const [rewardDescription, setRewardDescription] = useState('');

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(value);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, slug, rewardThreshold: Number(rewardThreshold), rewardDescription });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      <div className="field">
        <label htmlFor="business-name">Business name</label>
        <input
          id="business-name"
          className="input"
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="punches-needed">Punches needed</label>
        <input
          id="punches-needed"
          className="input"
          type="number"
          min="1"
          value={rewardThreshold}
          onChange={(e) => setRewardThreshold(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="reward-description">Reward, in your words</label>
        <input
          id="reward-description"
          className="input"
          type="text"
          value={rewardDescription}
          onChange={(e) => setRewardDescription(e.target.value)}
          required
        />
      </div>

      <LogoPicker />

      <div className="field">
        <label htmlFor="check-in-url">Check-in URL</label>
        <input
          id="check-in-url"
          className="input"
          style={{ fontFamily: 'ui-monospace, monospace' }}
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          required
        />
        {slugError ? (
          <p style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: '6px 0 0' }}>{slugError}</p>
        ) : (
          <p className="text-muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
            {window.location.host}/{slug || '…'}. This gets printed on your sign, so it can't change later. Take a
            second look.
          </p>
        )}
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        Create shop
      </button>
    </form>
  );
}
