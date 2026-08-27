import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingCheckinRow } from './PendingCheckinRow';

const checkin = { id: 'pending-1', maskedPhone: '•••-•••-4567', createdAt: new Date().toISOString() };

describe('PendingCheckinRow', () => {
  it('shows the masked phone number', () => {
    render(<PendingCheckinRow checkin={checkin} onConfirm={() => {}} confirmDisabled={false} />);

    expect(screen.getByText('•••-•••-4567')).toBeTruthy();
  });

  it('calls onConfirm with the check-in id when tapped', async () => {
    const onConfirm = vi.fn();
    render(<PendingCheckinRow checkin={checkin} onConfirm={onConfirm} confirmDisabled={false} />);

    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onConfirm).toHaveBeenCalledWith('pending-1');
  });

  it('disables the confirm button when no staff member is selected', () => {
    render(<PendingCheckinRow checkin={checkin} onConfirm={() => {}} confirmDisabled={true} />);

    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });
});
