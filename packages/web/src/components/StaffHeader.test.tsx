import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StaffHeader } from './StaffHeader';

// The header also renders a mobile-only settings icon link named "Settings",
// hidden by CSS on desktop but present in the DOM. Scope tab assertions to
// the primary <nav> so that icon never collides with the "Settings" tab.
const tabs = () => within(screen.getByRole('navigation', { name: 'Primary' }));

function renderAt(path: string, onSignOut: () => void = () => {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StaffHeader
        slug="demo-shop"
        businessName="Demo Shop"
        logoUrl={null}
        userEmail="owner@demo-shop.com"
        userName={null}
        userRole="owner"
        onSignOut={onSignOut}
      />
    </MemoryRouter>,
  );
}

describe('StaffHeader', () => {
  it('marks the Dashboard tab active on the dashboard route, and no other tab', () => {
    renderAt('/dashboard/demo-shop');

    expect(tabs().getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(tabs().getByRole('link', { name: 'Customers' })).not.toHaveAttribute('aria-current');
    expect(tabs().getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });

  it('marks the Customers tab active on the customers route', () => {
    renderAt('/dashboard/demo-shop/customers');

    expect(tabs().getByRole('link', { name: 'Customers' })).toHaveAttribute('aria-current', 'page');
    expect(tabs().getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks the Settings tab active on the settings route', () => {
    renderAt('/dashboard/demo-shop/settings');

    expect(tabs().getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(tabs().getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('shows the business name', () => {
    renderAt('/dashboard/demo-shop');

    expect(screen.getByText('Demo Shop')).toBeTruthy();
  });

  it('opens the account menu and calls onSignOut from it', async () => {
    const onSignOut = vi.fn();
    renderAt('/dashboard/demo-shop', onSignOut);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('owner@demo-shop.com')).toBeTruthy();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(onSignOut).toHaveBeenCalled();
  });

  it('opens the About modal from the nav', async () => {
    renderAt('/dashboard/demo-shop');

    expect(screen.queryByRole('heading', { name: 'About TallyUp' })).toBeNull();
    await userEvent.click(tabs().getByRole('button', { name: 'About' }));

    expect(screen.getByRole('heading', { name: 'About TallyUp' })).toBeTruthy();
  });
});
