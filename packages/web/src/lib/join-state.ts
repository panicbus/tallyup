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

  // A real staff row means they are active somewhere already -- one shop per
  // account. If it is this shop, that is a friendly "you're already in".
  if (me) {
    return me.business.slug === invite.businessSlug
      ? { kind: 'already_here', invite }
      : { kind: 'already_elsewhere', businessName: me.business.name };
  }

  if (!sessionEmail) {
    return { kind: 'needs_account', invite };
  }

  if (normalizeEmail(sessionEmail) !== normalizeEmail(invite.email)) {
    return { kind: 'wrong_account', invite, signedInAs: sessionEmail };
  }

  return { kind: 'ready', invite };
}
