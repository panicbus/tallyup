import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMe, lookupInvite, redeemInvite } from '../lib/api';
import type { InviteDescription, MeResponse } from '../lib/api';
import { resolveJoinState, type JoinState } from '../lib/join-state';
import { supabaseClient } from '../lib/supabase';
import { AuthShell } from '../components/AuthShell';
import { LoginForm } from '../components/LoginForm';

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; state: JoinState; invite: InviteDescription | null; me: MeResponse | null };

function roleNoun(role: 'owner' | 'staff'): string {
  return role === 'owner' ? 'an owner' : 'staff';
}

export function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get('token') ?? '';

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [authMode, setAuthMode] = useState<'create' | 'signin' | 'confirm_pending'>('create');
  const [authError, setAuthError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [redeemError, setRedeemError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoaded({ status: 'loading' });
    if (!code) {
      setLoaded({ status: 'ready', state: { kind: 'not_found' }, invite: null, me: null });
      return;
    }
    const [invite, me, session] = await Promise.all([
      lookupInvite(code).catch(() => null),
      getMe(),
      supabaseClient.auth.getSession(),
    ]);
    const sessionEmail = session.data.session?.user?.email ?? null;
    setLoaded({
      status: 'ready',
      state: resolveJoinState({ invite, me, sessionEmail }),
      invite,
      me,
    });
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRedeem() {
    setBusy(true);
    setRedeemError(undefined);
    try {
      const result = await redeemInvite(code);
      if (result.outcome === 'redeemed') {
        if (loaded.status === 'ready' && loaded.invite) {
          navigate(`/dashboard/${loaded.invite.businessSlug}`);
        } else {
          const me = await getMe();
          navigate(me ? `/dashboard/${me.business.slug}` : '/login');
        }
        return;
      }
      if (result.outcome === 'invalid_code') {
        setRedeemError('This invitation is no longer valid.');
      } else if (result.outcome === 'wrong_account') {
        setRedeemError('This invitation was sent to a different email address.');
      } else {
        setRedeemError('This account is already linked to a shop.');
      }
    } catch {
      setRedeemError('Could not accept the invitation. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(email: string, password: string) {
    setBusy(true);
    setAuthError(undefined);
    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) {
          setAuthMode('signin');
          setAuthError('You already have a TallyUp account. Enter your password to sign in.');
        } else {
          setAuthError(error.message);
        }
        return;
      }
      if (!data.session) {
        // Supabase is set to require email confirmation (or the address was
        // already registered): no session yet, so redemption waits for a
        // second visit. The invite stays valid.
        setAuthMode('confirm_pending');
        return;
      }
      await handleRedeem();
    } catch {
      setAuthError('Could not create your account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(email: string, password: string) {
    setBusy(true);
    setAuthError(undefined);
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError('That password did not work. Try again.');
        return;
      }
      await handleRedeem();
    } catch {
      setAuthError('Could not sign you in. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await supabaseClient.auth.signOut();
    setAuthMode('create');
    setAuthError(undefined);
    await load();
  }

  if (loaded.status === 'loading') {
    return (
      <div className="page">
        <div className="page-content" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  const { state } = loaded;

  if (state.kind === 'not_found') {
    return (
      <Message
        heading="Invitation not found"
        body="This invitation is no longer valid. Ask whoever invited you to send a new one."
        action={{ label: 'Go to sign in', onClick: () => navigate('/login') }}
      />
    );
  }

  if (state.kind === 'already_here') {
    return (
      <Message
        heading={`You're already on the team at ${state.invite.businessName}`}
        body="Nothing more to do here."
        action={{ label: 'Go to dashboard', onClick: () => navigate(`/dashboard/${state.invite.businessSlug}`) }}
      />
    );
  }

  if (state.kind === 'already_elsewhere') {
    return (
      <Message
        heading={`You're already on the team at ${state.businessName}`}
        body="A TallyUp account can belong to one shop at a time. Sign out and use a different email to accept this invitation."
        action={{ label: 'Sign out', onClick: handleSignOut }}
      />
    );
  }

  if (state.kind === 'wrong_account') {
    return (
      <Message
        heading="This invitation is for a different address"
        body={`It was sent to ${state.invite.email}, but you are signed in as ${state.signedInAs}. Sign out to accept it.`}
        action={{ label: 'Sign out', onClick: handleSignOut }}
      />
    );
  }

  if (state.kind === 'ready') {
    return (
      <AuthShell
        heading={`Join ${state.invite.businessName}`}
        subheading={`${state.invite.invitedBy} invited you as ${roleNoun(state.invite.role)}.`}
      >
        {redeemError && (
          <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: 0 }}>
            {redeemError}
          </p>
        )}
        <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={handleRedeem}>
          {busy ? 'Joining…' : `Join ${state.invite.businessName}`}
        </button>
      </AuthShell>
    );
  }

  // state.kind === 'needs_account'
  const { invite } = state;

  if (authMode === 'confirm_pending') {
    return (
      <Message
        heading="Confirm your email"
        body={`We sent a confirmation link to ${invite.email}. Confirm it, then open this invitation link again to finish joining ${invite.businessName}.`}
      />
    );
  }

  return (
    <AuthShell
      heading={`Join ${invite.businessName}`}
      subheading={`${invite.invitedBy} invited you as ${roleNoun(invite.role)}.`}
      footer={
        <button
          type="button"
          onClick={() => {
            setAuthMode(authMode === 'create' ? 'signin' : 'create');
            setAuthError(undefined);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            color: 'var(--color-accent-700)',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {authMode === 'create' ? 'Already have a TallyUp password? Sign in' : 'Need an account? Create one'}
        </button>
      }
    >
      <LoginForm
        key={authMode}
        onSubmit={authMode === 'create' ? handleSignUp : handleSignIn}
        submitting={busy}
        error={authError}
        lockedEmail={invite.email}
        submitLabel={authMode === 'create' ? 'Create account and join' : 'Sign in and join'}
      />
    </AuthShell>
  );
}

function Message({
  heading,
  body,
  action,
}: {
  heading: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="page">
      <div className="page-content" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ margin: 0 }}>{heading}</h2>
        <p className="text-muted" style={{ margin: 0, maxWidth: 320 }}>
          {body}
        </p>
        {action && (
          <button type="button" className="btn btn-primary" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
