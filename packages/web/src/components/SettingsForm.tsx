import { useState, type FormEvent } from 'react';

interface SettingsFormBusiness {
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
}

export interface SettingsFormValues {
  name: string;
  rewardThreshold: number;
  rewardDescription: string;
}

interface SettingsFormProps {
  business: SettingsFormBusiness;
  onSubmit: (values: SettingsFormValues) => void;
  submitting: boolean;
  error?: string;
}

export function SettingsForm({ business, onSubmit, submitting, error }: SettingsFormProps) {
  const [name, setName] = useState(business.name);
  const [rewardThreshold, setRewardThreshold] = useState(String(business.rewardThreshold));
  const [rewardDescription, setRewardDescription] = useState(business.rewardDescription);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, rewardThreshold: Number(rewardThreshold), rewardDescription });
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p role="alert">{error}</p>}
      <p>
        Check-in URL: <strong>{business.slug}</strong> — printed on your signage, can't be changed here.
      </p>
      <label>
        Business name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
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
      <p>Lowering this makes some customers instantly eligible for a reward.</p>
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
        Save changes
      </button>
    </form>
  );
}
