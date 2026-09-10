import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileMenu } from './ProfileMenu';

describe('ProfileMenu', () => {
  it('shows the first letter of the email and keeps the menu closed until clicked', () => {
    render(<ProfileMenu email="Sam@example.com" onSignOut={() => {}} />);

    expect(screen.getByRole('button', { name: /account menu/i })).toHaveTextContent('S');
    expect(screen.queryByText('Sign out')).toBeNull();
  });

  it('opens the menu with the full address and a sign-out action', async () => {
    const onSignOut = vi.fn();
    render(<ProfileMenu email="sam@example.com" onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));

    expect(screen.getByText('Signed in as:')).toBeTruthy();
    expect(screen.getByText('sam@example.com')).toBeTruthy();

    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    render(<ProfileMenu email="sam@example.com" onSignOut={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('Signed in as:')).toBeTruthy();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Signed in as:')).toBeNull();
  });
});
