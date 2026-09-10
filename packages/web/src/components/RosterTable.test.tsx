import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RosterTable } from './RosterTable';
import { rosterItems as items } from '../test-support/roster-fixtures';

describe('RosterTable', () => {
  it('renders one row per customer with the phone, current points, lifetime points, and rewards given', () => {
    render(<RosterTable items={items} />);

    expect(screen.getByText('(555) 123-1234')).toBeTruthy();
    expect(screen.getByText('•••-•••-5678')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('13')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Current points' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Lifetime points' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Rewards given' })).toBeTruthy();
  });

  it('shows an opted-in tag only for the consented customer', () => {
    render(<RosterTable items={items} />);

    expect(screen.getAllByText('Opted in')).toHaveLength(1);
  });

  it('renders an empty table body for no customers', () => {
    render(<RosterTable items={[]} />);

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.queryByText('(555) 123-1234')).toBeNull();
  });
});
