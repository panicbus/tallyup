import { formatUsPhoneInput } from '../lib/format';

interface PhoneFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  autoFocus?: boolean;
}

/** A phone-number field: US display formatting as you type, and an
 * optional validation message below it. Owns no phone-validity state of
 * its own — the caller runs `phoneSchema` at submit time and passes the
 * resulting error back in, same division of labor as `PasswordInput`
 * owning only its show/hide toggle. Shared by CheckInForm and Card. */
export function PhoneField({ id = 'phone', label = 'Phone number', value, onChange, error, autoFocus }: PhoneFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        style={{ fontSize: 17, padding: '14px 16px' }}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(555) 555-1234"
        value={value}
        onChange={(e) => onChange(formatUsPhoneInput(e.target.value))}
        autoFocus={autoFocus}
      />
      {error && (
        <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: '8px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}
