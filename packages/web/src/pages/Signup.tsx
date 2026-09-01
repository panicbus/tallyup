import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
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
        <div className="page-content" style={{ position: 'relative' }}>
          <Link
            to="/"
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'var(--color-neutral-600)',
              display: 'flex',
            }}
          >
            <X size={20} />
          </Link>
          <img src="/logo.svg" alt="" width={48} height={48} style={{ marginBottom: 4 }} />
          <div>
            <h2 style={{ margin: '0 0 4px' }}>Create your account</h2>
            <p className="text-muted" style={{ margin: 0 }}>
              Set it up and you're ready to roll.
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
