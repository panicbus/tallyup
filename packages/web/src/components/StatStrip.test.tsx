import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatStrip } from './StatStrip';

describe('StatStrip', () => {
  it('labels the window and singularises a count of 1', () => {
    render(<StatStrip checkins={1} newCustomers={1} rewards={1} windowDays={7} />);

    expect(screen.getByText('Past 7 days')).toBeTruthy();
    expect(screen.getByText('check-in')).toBeTruthy();
    expect(screen.getByText('new customer')).toBeTruthy();
    expect(screen.getByText('reward given')).toBeTruthy();
  });

  it('pluralises every other count, including zero', () => {
    render(<StatStrip checkins={0} newCustomers={12} rewards={3} windowDays={7} />);

    expect(screen.getByText('check-ins')).toBeTruthy();
    expect(screen.getByText('new customers')).toBeTruthy();
    expect(screen.getByText('rewards given')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });
});
