import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('submits the entered email and password', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(onSubmit).toHaveBeenCalledWith('owner@example.com', 'hunter2');
  });

  it('disables the button while submitting', () => {
    render(<LoginForm onSubmit={() => {}} submitting={true} />);

    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('shows an error message when given one', () => {
    render(<LoginForm onSubmit={() => {}} submitting={false} error="Invalid email or password." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('uses a custom submit label when given one', () => {
    render(<LoginForm onSubmit={() => {}} submitting={false} submitLabel="Create account" />);

    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
  });

  it('toggles the password field between hidden and visible', async () => {
    render(<LoginForm onSubmit={() => {}} submitting={false} />);
    const passwordField = screen.getByLabelText(/password/i);

    expect(passwordField).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passwordField).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordField).toHaveAttribute('type', 'password');
  });
});
