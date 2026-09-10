import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RosterCardList } from './RosterCardList';
import type { RosterEntry } from '../lib/api';

const items: RosterEntry[] = [
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

describe('RosterCardList', () => {
  it('renders one card per customer with the phone, current points, lifetime points, and rewards given', () => {
    render(<RosterCardList items={items} />);

    expect(screen.getByText('(555) 123-1234')).toBeTruthy();
    expect(screen.getByText('•••-•••-5678')).toBeTruthy();
    expect(screen.getByText('3 pts now')).toBeTruthy();
    expect(screen.getByText('13 lifetime')).toBeTruthy();
    expect(screen.getByText('1 reward given')).toBeTruthy();
    expect(screen.getByText('0 rewards given')).toBeTruthy();
  });

  it('shows an opted-in tag only for the consented customer', () => {
    render(<RosterCardList items={items} />);

    expect(screen.getAllByText('Opted in')).toHaveLength(1);
  });
});
