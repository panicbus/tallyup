import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { LogoPicker } from './LogoPicker';

interface SettingsFormBusiness {
  name: string;
  slug: string;
  rewardThreshold: number;
  rewardDescription: string;
  logoUrl: string | null;
}

export interface SettingsFormValues {
  name: string;
  rewardThreshold: number;
  rewardDescription: string;
  logoUrl: string | null;
}

interface SettingsFormProps {
  business: SettingsFormBusiness;
  onSubmit: (values: SettingsFormValues) => void;
  submitting: boolean;
  saved: boolean;
  error?: string;
}

export function SettingsForm({ business, onSubmit, submitting, saved, error }: SettingsFormProps) {
  const [name, setName] = useState(business.name);
  const [rewardThreshold, setRewardThreshold] = useState(String(business.rewardThreshold));
  const [rewardDescription, setRewardDescription] = useState(business.rewardDescription);
  const [logoUrl, setLogoUrl] = useState<string | null>(business.logoUrl);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, rewardThreshold: Number(rewardThreshold), rewardDescription, logoUrl });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      <div className="field-grid-2">
        <div className="field">
          <label htmlFor="settings-business-name">Business name</label>
          <input
            id="settings-business-name"
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="settings-punches-needed">Punches needed</label>
          <input
            id="settings-punches-needed"
            className="input"
            type="number"
            min="1"
            value={rewardThreshold}
            onChange={(e) => setRewardThreshold(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="settings-reward-description">Reward, in your words</label>
        <input
          id="settings-reward-description"
          className="input"
          type="text"
          value={rewardDescription}
          onChange={(e) => setRewardDescription(e.target.value)}
          required
        />
      </div>

      <LogoPicker value={logoUrl} onChange={setLogoUrl} />

      <div className="field">
        <label htmlFor="settings-check-in-url">Check-in URL</label>
        <input
          id="settings-check-in-url"
          className="input"
          style={{ fontFamily: 'ui-monospace, monospace', opacity: 0.6 }}
          type="text"
          value={business.slug}
          disabled
        />
        <p className="text-muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
          Locked. It's printed on your counter sign.
        </p>
      </div>

      <div
        style={{
          background: 'var(--color-accent-100)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          gap: 10,
          fontSize: 13,
        }}
      >
        <AlertTriangle size={16} color="var(--color-accent-700)" style={{ flex: 'none', marginTop: 2 }} />
        <span>Lowering the punches needed can make customers already partway there instantly eligible for a reward.</span>
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        Save changes
      </button>
      {saved && (
        <span className="saved-pill">
          <CheckCircle size={14} /> Saved
        </span>
      )}
    </form>
  );
}
