import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RosterCardList } from './RosterCardList';
import { rosterItems as items } from '../test-support/roster-fixtures';

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
