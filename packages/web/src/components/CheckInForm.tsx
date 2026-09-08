import { useState, type FormEvent } from 'react';
import { phoneSchema, smsConsentLanguageV1 } from '@tallyup/shared';
import { formatUsPhoneInput } from '../lib/format';

interface CheckInFormProps {
  onSubmit: (phone: string, smsConsent: boolean) => void;
  submitting: boolean;
  businessName: string;
  /** Pre-fill, e.g. when a customer taps "Check in again". */
  initialPhone?: string;
  /** True once a number is known to have SMS consent on file — the consent
   * checkbox is then hidden, since re-asking would just append a duplicate
   * ledger row. Re-evaluated as the field is edited. */
  isPhoneKnownConsented?: (phone: string) => boolean;
}

export function CheckInForm({
  onSubmit,
  submitting,
  businessName,
  initialPhone = '',
  isPhoneKnownConsented,
}: CheckInFormProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consentKnown = isPhoneKnownConsented?.(phone) ?? false;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError("That doesn't look like a full phone number yet.");
      return;
    }
    setError(null);
    onSubmit(phone, smsConsent);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
      <div className="field">
        <label htmlFor="phone">Phone number</label>
        <input
          id="phone"
          className="input"
          style={{ fontSize: 17, padding: '14px 16px' }}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(555) 555-1234"
          value={phone}
          onChange={(e) => setPhone(formatUsPhoneInput(e.target.value))}
        />
        {error && (
          <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: '8px 0 0' }}>
            {error}
          </p>
        )}
      </div>
      {!consentKnown && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span className="text-muted">{smsConsentLanguageV1(businessName)}</span>
        </label>
      )}
      <button
        type="submit"
        className="btn btn-primary btn-block"
        style={{ fontSize: 16, padding: 16, marginTop: 'auto' }}
        disabled={submitting}
      >
        {submitting ? 'Checking in…' : 'Check in'}
      </button>
    </form>
  );
}
