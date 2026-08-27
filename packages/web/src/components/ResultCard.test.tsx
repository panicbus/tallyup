import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultCard } from './ResultCard';

const eligible = {
  customerId: 'customer-1',
  maskedPhone: '•••-•••-4567',
  points: 10,
  rewardThreshold: 10,
  eligibleForRedemption: true,
};

const notEligible = { ...eligible, points: 3, eligibleForRedemption: false };

describe('ResultCard', () => {
  it('shows the masked phone and point total', () => {
    render(<ResultCard result={notEligible} onRedeem={() => {}} onDismiss={() => {}} redeemDisabled={false} />);

    expect(screen.getByText('•••-•••-4567')).toBeTruthy();
    expect(screen.getByText('3/10')).toBeTruthy();
  });

  it('offers Redeem when eligible', () => {
    render(<ResultCard result={eligible} onRedeem={() => {}} onDismiss={() => {}} redeemDisabled={false} />);

    expect(screen.getByRole('button', { name: /redeem/i })).toBeTruthy();
  });

  it('does not offer Redeem when not eligible', () => {
    render(<ResultCard result={notEligible} onRedeem={() => {}} onDismiss={() => {}} redeemDisabled={false} />);

    expect(screen.queryByRole('button', { name: /redeem/i })).toBeNull();
  });

  it('calls onRedeem with the customer id when tapped', async () => {
    const onRedeem = vi.fn();
    render(<ResultCard result={eligible} onRedeem={onRedeem} onDismiss={() => {}} redeemDisabled={false} />);

    await userEvent.click(screen.getByRole('button', { name: /redeem/i }));

    expect(onRedeem).toHaveBeenCalledWith('customer-1');
  });

  it('calls onDismiss with the customer id when dismissed', async () => {
    const onDismiss = vi.fn();
    render(<ResultCard result={eligible} onRedeem={() => {}} onDismiss={onDismiss} redeemDisabled={false} />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalledWith('customer-1');
  });
});
