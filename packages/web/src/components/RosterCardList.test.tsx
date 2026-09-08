import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RosterCardList } from './RosterCardList';
import type { RosterEntry } from '../lib/api';

const items: RosterEntry[] = [
  { id: 'c1', maskedPhone: '•••-•••-1234', points: 3, joinedAt: '2026-01-01T00:00:00Z', hasSmsConsent: true },
  { id: 'c2', maskedPhone: '•••-•••-5678', points: 0, joinedAt: '2026-02-01T00:00:00Z', hasSmsConsent: false },
];

describe('RosterCardList', () => {
  it('renders one card per customer with masked phone and points', () => {
    render(<RosterCardList items={items} />);

    expect(screen.getByText('•••-•••-1234')).toBeTruthy();
    expect(screen.getByText('•••-•••-5678')).toBeTruthy();
    expect(screen.getByText('3 pts')).toBeTruthy();
  });

  it('shows an opted-in tag only for the consented customer', () => {
    render(<RosterCardList items={items} />);

    expect(screen.getAllByText('Opted in')).toHaveLength(1);
  });
});
