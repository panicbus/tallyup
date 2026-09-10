import { describe, expect, it } from 'vitest';
import { resolveJoinState } from './join-state';
import type { InviteDescription } from './api';

const invite: InviteDescription = {
  businessName: 'Blue Bottle Coffee',
  businessSlug: 'blue-bottle',
  invitedBy: 'sofia@bluebottle.com',
  role: 'staff',
  email: 'sam@example.com',
  expiresAt: '2026-09-20T00:00:00Z',
};

describe('resolveJoinState', () => {
  it('is not_found when the invite lookup returned nothing', () => {
    expect(resolveJoinState({ invite: null, me: null, sessionEmail: null })).toEqual({ kind: 'not_found' });
  });

  it('needs an account when there is no session', () => {
    expect(resolveJoinState({ invite, me: null, sessionEmail: null })).toEqual({ kind: 'needs_account', invite });
  });

  it('is ready when a session exists for the invited address and the user is not staff yet', () => {
    expect(resolveJoinState({ invite, me: null, sessionEmail: 'sam@example.com' })).toEqual({ kind: 'ready', invite });
  });

  it('treats the invited address case-insensitively', () => {
    expect(resolveJoinState({ invite, me: null, sessionEmail: '  SAM@Example.com ' })).toEqual({ kind: 'ready', invite });
  });

  it('is wrong_account when the session belongs to a different address', () => {
    expect(resolveJoinState({ invite, me: null, sessionEmail: 'raj@example.com' })).toEqual({
      kind: 'wrong_account',
      invite,
      signedInAs: 'raj@example.com',
    });
  });

  it('is already_here when the user is already staff of the inviting business', () => {
    expect(
      resolveJoinState({
        invite,
        me: { business: { slug: 'blue-bottle', name: 'Blue Bottle Coffee' } },
        sessionEmail: 'sam@example.com',
      }),
    ).toEqual({ kind: 'already_here', invite });
  });

  it('is already_elsewhere when the user is already staff of a different business', () => {
    expect(
      resolveJoinState({
        invite,
        me: { business: { slug: 'other-shop', name: 'Other Shop' } },
        sessionEmail: 'sam@example.com',
      }),
    ).toEqual({ kind: 'already_elsewhere', businessName: 'Other Shop' });
  });
});
