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
    <div className="page">
      <div className="auth-stage">
        <div className="page-content">
          <div>
            <h2 style={{ margin: '0 0 4px' }}>Create your account</h2>
            <p className="text-muted" style={{ margin: 0 }}>
              Set up once, the night before you open.
            </p>
          </div>
          <LoginForm onSubmit={handleSubmit} submitting={submitting} error={error} submitLabel="Create account" />
          <Link to="/login" style={{ fontSize: 13, textAlign: 'center' }}>
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
