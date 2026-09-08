import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabaseClient } from '../lib/supabase';
import { AuthShell } from '../components/AuthShell';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Deliberately ignore the result: whether or not the address has an
    // account, the response is the same, so this can't be used to probe
    // which emails are registered.
    await supabaseClient.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true);
    setSubmitting(false);
  }

  if (sent) {
    return (
      <AuthShell
        heading="Check your email"
        subheading={`If an account uses ${email.trim()}, a reset link is on its way.`}
        footer={<Link to="/login">Back to sign in</Link>}
      >
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
          The link opens a page where you can set a new password. It expires after a little while — request another if
          it does.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Reset your password"
      subheading="We'll email you a link to set a new one."
      footer={<Link to="/login">Back to sign in</Link>}
    >
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
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  );
}
