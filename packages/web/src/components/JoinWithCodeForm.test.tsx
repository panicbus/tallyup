import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinWithCodeForm } from './JoinWithCodeForm';

describe('JoinWithCodeForm', () => {
  it('submits the trimmed code', async () => {
    const onSubmit = vi.fn();
    render(<JoinWithCodeForm onSubmit={onSubmit} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/invite code/i), '  abc123  ');
    await userEvent.click(screen.getByRole('button', { name: /join shop/i }));

    expect(onSubmit).toHaveBeenCalledWith('abc123');
  });

  it('shows an error message when provided', () => {
    render(<JoinWithCodeForm onSubmit={() => {}} submitting={false} error="That code is invalid or has expired." />);

    expect(screen.getByRole('alert')).toHaveTextContent('That code is invalid or has expired.');
  });

  it('disables the button while submitting', () => {
    render(<JoinWithCodeForm onSubmit={() => {}} submitting={true} />);

    expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled();
  });
});
