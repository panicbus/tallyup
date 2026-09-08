import { useState, type FormEvent } from 'react';

interface JoinWithCodeFormProps {
  onSubmit: (code: string) => void;
  submitting: boolean;
  error?: string;
}

export function JoinWithCodeForm({ onSubmit, submitting, error }: JoinWithCodeFormProps) {
  const [code, setCode] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(code.trim());
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="field">
        <label htmlFor="invite-code">Invite code</label>
        <input
          id="invite-code"
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste the code your owner sent you"
        />
        {error && (
          <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: '8px 0 0' }}>
            {error}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Joining…' : 'Join shop'}
      </button>
    </form>
  );
}
