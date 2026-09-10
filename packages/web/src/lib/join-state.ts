import { normalizeEmail } from '@tallyup/shared';
import type { InviteDescription } from './api';

/**
 * What the join page should render, decided purely from the invite lookup,
 * whether the visitor has a session, and whether they are already staff.
 * The signup sub-flow (create / sign in / confirm your email) lives in the
 * Join component itself, since those depend on what Supabase returned from a
 * signup attempt, not on this input.
 */
export type JoinState =
  | { kind: 'not_found' }
  | { kind: 'needs_account'; invite: InviteDescription }
  | { kind: 'wrong_account'; invite: InviteDescription; signedInAs: string }
  | { kind: 'already_here'; invite: InviteDescription }
  | { kind: 'already_elsewhere'; businessName: string }
  | { kind: 'ready'; invite: InviteDescription };

export function resolveJoinState(input: {
  invite: InviteDescription | null;
  me: { business: { slug: string; name: string } } | null;
  sessionEmail: string | null;
}): JoinState {
  const { invite, me, sessionEmail } = input;

  if (!invite) {
    return { kind: 'not_found' };
  }

  // Signed in as an account the invite is not addressed to. This comes
  // before the "already on the team" checks on purpose: an owner who opens
  // an invite they sent (while still signed in as themselves) lands here,
  // not on "you're already on the team" -- which read as a bug to them.
  // They have to sign out and use the invited address to accept it.
  if (sessionEmail != null && normalizeEmail(sessionEmail) !== normalizeEmail(invite.email)) {
    return { kind: 'wrong_account', invite, signedInAs: sessionEmail };
  }

  // A real staff row means they are active somewhere already -- one shop per
  // account. If it is this shop, that is a friendly "you're on the team".
  if (me) {
    return me.business.slug === invite.businessSlug
      ? { kind: 'already_here', invite }
      : { kind: 'already_elsewhere', businessName: me.business.name };
  }

  if (!sessionEmail) {
    return { kind: 'needs_account', invite };
  }

  return { kind: 'ready', invite };
}
