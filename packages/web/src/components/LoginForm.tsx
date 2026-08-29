import { useState, type FormEvent } from 'react';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => void;
  submitting: boolean;
  error?: string;
  submitLabel?: string;
}

export function LoginForm({ onSubmit, submitting, error, submitLabel = 'Sign in' }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(email, password);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          placeholder="you@yourshop.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitLabel}
      </button>
    </form>
  );
}
