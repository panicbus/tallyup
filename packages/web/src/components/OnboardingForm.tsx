import { useState, type FormEvent } from 'react';
import { slugify } from '@tallyup/shared';

export interface OnboardingFormValues {
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
}

interface OnboardingFormProps {
  onSubmit: (values: OnboardingFormValues) => void;
  submitting: boolean;
  error?: string;
}

export function OnboardingForm({ onSubmit, submitting, error }: OnboardingFormProps) {
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
    <form onSubmit={handleSubmit}>
      {error && <p role="alert">{error}</p>}
      <label>
        Business name
        <input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
      </label>
      <label>
        Check-in URL
        <input type="text" value={slug} onChange={(e) => handleSlugChange(e.target.value)} required />
      </label>
      <label>
        Punches needed
        <input
          type="number"
          min="1"
          value={rewardThreshold}
          onChange={(e) => setRewardThreshold(e.target.value)}
          required
        />
      </label>
      <label>
        Reward description
        <input
          type="text"
          value={rewardDescription}
          onChange={(e) => setRewardDescription(e.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={submitting}>
        Create business
      </button>
    </form>
  );
}
