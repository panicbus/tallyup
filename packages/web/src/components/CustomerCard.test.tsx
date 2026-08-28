import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerCard } from './CustomerCard';

describe('CustomerCard', () => {
  it('shows the point total against the threshold', () => {
    render(
      <CustomerCard points={3} rewardThreshold={10} rewardDescription="Free book" eligibleForRedemption={false} />,
    );

    expect(screen.getByText('3/10')).toBeTruthy();
  });

  it('shows the reward description', () => {
    render(
      <CustomerCard points={3} rewardThreshold={10} rewardDescription="Free book" eligibleForRedemption={false} />,
    );

    expect(screen.getByText(/Free book/)).toBeTruthy();
  });

  it('announces when the reward is ready', () => {
    render(
      <CustomerCard points={10} rewardThreshold={10} rewardDescription="Free book" eligibleForRedemption={true} />,
    );

    expect(screen.getByText(/ready/i)).toBeTruthy();
  });

  it('does not announce readiness below the threshold', () => {
    render(
      <CustomerCard points={3} rewardThreshold={10} rewardDescription="Free book" eligibleForRedemption={false} />,
    );

    expect(screen.queryByText(/ready/i)).toBeNull();
  });
});
