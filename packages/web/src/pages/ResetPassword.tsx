import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { arrivedViaPasswordRecovery, supabaseClient } from '../lib/supabase';
import { getMe } from '../lib/api';
import { AuthShell } from '../components/AuthShell';

type Phase = 'checking' | 'ready' | 'invalid' | 'saving';

export function ResetPassword() {
  const navigate = useNavigate();
  // A recovery link is the only way in. An already-signed-in session is not
  // enough — that would let anyone open this page and change their password
  // without proving they still hold the email.
  const [phase, setPhase] = useState<Phase>(arrivedViaPasswordRecovery ? 'ready' : 'checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (arrivedViaPasswordRecovery) return;
    // Supabase may still fire PASSWORD_RECOVERY if it consumed the hash
    // before this component mounted; give it a beat, then call it invalid.
    const { data: sub } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPhase('ready');
    });
    const timer = setTimeout(() => setPhase((current) => (current === 'checking' ? 'invalid' : current)), 1500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPhase('saving');
    setError(undefined);

    const { error: updateError } = await supabaseClient.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setPhase('ready');
      return;
    }

    const me = await getMe();
    navigate(me ? `/dashboard/${me.business.slug}` : '/onboarding');
  }

  if (phase === 'checking') {
    return (
      <AuthShell heading="One moment…">
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Checking your reset link.</p>
      </AuthShell>
    );
  }

  if (phase === 'invalid') {
    return (
      <AuthShell
        heading="This link isn't valid"
        subheading="It may have expired or already been used."
        footer={<Link to="/forgot-password">Request a new link</Link>}
      >
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
          Reset links are single-use and time-limited. Ask for a fresh one and try again.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Set a new password">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
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
        <button type="submit" className="btn btn-primary btn-block" disabled={phase === 'saving'}>
          {phase === 'saving' ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthShell>
  );
}
