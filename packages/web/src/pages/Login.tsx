import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '../lib/supabase';
import { getMe } from '../lib/api';
import { LoginForm } from '../components/LoginForm';

export function Login() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(email: string, password: string) {
    setSubmitting(true);
    setError(undefined);

    const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Invalid email or password.');
      setSubmitting(false);
      return;
    }

    const me = await getMe();
    if (!me) {
      setError('Signed in, but no staff account is linked to this login.');
      setSubmitting(false);
      return;
    }

    navigate(`/dashboard/${me.business.slug}`);
  }

  return (
    <main>
      <h1>Staff sign in</h1>
      <LoginForm onSubmit={handleSubmit} submitting={submitting} error={error} />
    </main>
  );
}
