import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerCard } from './CustomerCard';

describe('CustomerCard', () => {
  it('shows the point total against the threshold', () => {
    render(
      <CustomerCard
        businessName="Chapter & Verse"
        points={3}
        rewardThreshold={10}
        rewardDescription="Free book"
        eligibleForRedemption={false}
      />,
    );

    expect(screen.getByText('3 / 10')).toBeTruthy();
  });

  it('shows the business name', () => {
    render(
      <CustomerCard
        businessName="Chapter & Verse"
        points={3}
        rewardThreshold={10}
        rewardDescription="Free book"
        eligibleForRedemption={false}
      />,
    );

    expect(screen.getByText('Chapter & Verse')).toBeTruthy();
  });

  it('shows the reward description', () => {
    render(
      <CustomerCard
        businessName="Chapter & Verse"
        points={3}
        rewardThreshold={10}
        rewardDescription="Free book"
        eligibleForRedemption={false}
      />,
    );

    expect(screen.getByText(/Free book/)).toBeTruthy();
  });

  it('announces when the reward is ready', () => {
    render(
      <CustomerCard
        businessName="Chapter & Verse"
        points={10}
        rewardThreshold={10}
        rewardDescription="Free book"
        eligibleForRedemption={true}
      />,
    );

    expect(screen.getByText(/reward ready/i)).toBeTruthy();
    expect(screen.getByText(/show this screen to staff/i)).toBeTruthy();
  });

  it('does not announce readiness below the threshold', () => {
    render(
      <CustomerCard
        businessName="Chapter & Verse"
        points={3}
        rewardThreshold={10}
        rewardDescription="Free book"
        eligibleForRedemption={false}
      />,
    );

    expect(screen.queryByText(/reward ready/i)).toBeNull();
  });

  it('renders one dot per punch needed, filled up to the current points', () => {
    const { container } = render(
      <CustomerCard
        businessName="Chapter & Verse"
        points={3}
        rewardThreshold={8}
        rewardDescription="Free book"
        eligibleForRedemption={false}
      />,
    );

    const dots = container.querySelectorAll('[data-dot]');
    expect(dots).toHaveLength(8);
    expect(container.querySelectorAll('[data-dot="filled"]')).toHaveLength(3);
  });
});
