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
    <form onSubmit={handleSubmit}>
      {error && <p role="alert">{error}</p>}
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button type="submit" disabled={submitting}>
        {submitLabel}
      </button>
    </form>
  );
}
