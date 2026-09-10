import type { RosterEntry } from '../lib/api';

/**
 * Two roster rows shared by the RosterTable and RosterCardList tests, which
 * render the same data two ways. c1 opted in to SMS (full formatted number,
 * a lifetime history); c2 did not (masked number, no activity yet).
 */
export const rosterItems: RosterEntry[] = [
  {
    id: 'c1',
    displayPhone: '(555) 123-1234',
    points: 3,
    lifetimePoints: 13,
    rewardsGiven: 1,
    joinedAt: '2026-01-01T00:00:00Z',
    hasSmsConsent: true,
  },
  {
    id: 'c2',
    displayPhone: '•••-•••-5678',
    points: 0,
    lifetimePoints: 0,
    rewardsGiven: 0,
    joinedAt: '2026-02-01T00:00:00Z',
    hasSmsConsent: false,
  },
];
