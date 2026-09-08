import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StaffHeader } from './StaffHeader';

function renderAt(path: string, onSignOut: () => void = () => {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StaffHeader slug="demo-shop" businessName="Demo Shop" logoUrl={null} onSignOut={onSignOut} />
    </MemoryRouter>,
  );
}

describe('StaffHeader', () => {
  it('marks the Dashboard tab active on the dashboard route, and no other tab', () => {
    renderAt('/dashboard/demo-shop');

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Customers' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });

  it('marks the Customers tab active on the customers route', () => {
    renderAt('/dashboard/demo-shop/customers');

    expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks the Settings tab active on the settings route', () => {
    renderAt('/dashboard/demo-shop/settings');

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('shows the business name', () => {
    renderAt('/dashboard/demo-shop');

    expect(screen.getByText('Demo Shop')).toBeTruthy();
  });

  it('calls onSignOut when the sign-out button is clicked', async () => {
    const onSignOut = vi.fn();
    renderAt('/dashboard/demo-shop', onSignOut);

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(onSignOut).toHaveBeenCalled();
  });
});
