import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabaseClient } from '../lib/supabase';
import { getMe } from '../lib/api';
import { LoginForm } from '../components/LoginForm';
import { AuthShell } from '../components/AuthShell';

export function Login() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(email: string, password: string) {
    setSubmitting(true);
    setError(undefined);

    const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Incorrect email or password.');
      setSubmitting(false);
      return;
    }

    const me = await getMe();
    navigate(me ? `/dashboard/${me.business.slug}` : '/onboarding');
  }

  return (
    <AuthShell
      heading="Sign in"
      footer={
        <>
          <Link to="/forgot-password">Forgot your password?</Link>
          <Link to="/signup">Need an account? Create one</Link>
        </>
      }
    >
      <LoginForm onSubmit={handleSubmit} submitting={submitting} error={error} />
    </AuthShell>
  );
}
