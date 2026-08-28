import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckInForm } from './CheckInForm';

describe('CheckInForm', () => {
  it('submits a normalizable phone number', async () => {
    const onSubmit = vi.fn();
    render(<CheckInForm onSubmit={onSubmit} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/phone/i), '555-123-4567');
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(onSubmit).toHaveBeenCalledWith('555-123-4567');
  });

  it('shows a validation error instead of submitting for an invalid number', async () => {
    const onSubmit = vi.fn();
    render(<CheckInForm onSubmit={onSubmit} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/phone/i), '123');
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('disables the button while submitting', () => {
    render(<CheckInForm onSubmit={() => {}} submitting={true} />);

    expect(screen.getByRole('button', { name: /check in/i })).toBeDisabled();
  });
});
