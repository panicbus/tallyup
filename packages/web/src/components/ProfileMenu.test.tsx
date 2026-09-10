import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileMenu } from './ProfileMenu';

describe('ProfileMenu', () => {
  it('uses the email when no name is set: initial and menu identity', async () => {
    render(<ProfileMenu email="sam@example.com" name={null} role="staff" onSignOut={() => {}} />);

    expect(screen.getByRole('button', { name: /account menu/i })).toHaveTextContent('S');
    expect(screen.queryByText('Sign out')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('sam@example.com')).toBeTruthy();
  });

  it('prefers the name over the email once it is set', async () => {
    render(<ProfileMenu email="sam@example.com" name="Riley" role="staff" onSignOut={() => {}} />);

    expect(screen.getByRole('button', { name: /account menu/i })).toHaveTextContent('R');

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('Riley')).toBeTruthy();
    expect(screen.queryByText('sam@example.com')).toBeNull();
  });

  it('opens the menu with the identity, the role, and a sign-out action', async () => {
    const onSignOut = vi.fn();
    render(<ProfileMenu email="sam@example.com" name="Riley" role="staff" onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));

    expect(screen.getByText('Signed in as:')).toBeTruthy();
    expect(screen.getByText('Staff')).toBeTruthy();

    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('labels an owner account "Owner"', async () => {
    render(<ProfileMenu email="owner@example.com" name={null} role="owner" onSignOut={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));

    expect(screen.getByText('Owner')).toBeTruthy();
  });

  it('closes on Escape', async () => {
    render(<ProfileMenu email="sam@example.com" name={null} role="staff" onSignOut={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('Signed in as:')).toBeTruthy();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Signed in as:')).toBeNull();
  });
});
