import { useState, type FormEvent } from 'react';
import { phoneSchema } from '@tallyup/shared';

interface CheckInFormProps {
  onSubmit: (phone: string) => void;
  submitting: boolean;
}

export function CheckInForm({ onSubmit, submitting }: CheckInFormProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError("That doesn't look like a valid phone number.");
      return;
    }
    setError(null);
    onSubmit(phone);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="phone">Phone number</label>
      <input
        id="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        Check in
      </button>
    </form>
  );
}
