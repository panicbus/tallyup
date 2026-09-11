import { useState, type FormEvent } from 'react';
import { phoneSchema, smsConsentLanguageV1 } from '@tallyup/shared';
import { PhoneField } from './PhoneField';

interface CheckInFormProps {
  onSubmit: (phone: string, smsConsent: boolean) => void;
  submitting: boolean;
  businessName: string;
  /** True once a number is known to have SMS consent on file. The consent
   * checkbox is then hidden, since re-asking would just append a duplicate
   * ledger row. Re-evaluated as the field is edited. */
  isPhoneKnownConsented?: (phone: string) => boolean;
}

export function CheckInForm({ onSubmit, submitting, businessName, isPhoneKnownConsented }: CheckInFormProps) {
  const [phone, setPhone] = useState('');
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
      <PhoneField value={phone} onChange={setPhone} error={error} />
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
