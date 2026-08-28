import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabaseClient } from '../lib/supabase';
import { getMe } from '../lib/api';
import { LoginForm } from '../components/LoginForm';

export function Signup() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(email: string, password: string) {
    setSubmitting(true);
    setError(undefined);

    const { error: signUpError } = await supabaseClient.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    const me = await getMe();
    navigate(me ? `/dashboard/${me.business.slug}` : '/onboarding');
  }

  return (
    <main>
      <h1>Create your business account</h1>
      <LoginForm onSubmit={handleSubmit} submitting={submitting} error={error} submitLabel="Create account" />
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
