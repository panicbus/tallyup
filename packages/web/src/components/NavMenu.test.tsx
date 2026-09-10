import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NavMenu } from './NavMenu';

const tabs = [
  { label: 'Dashboard', href: '/dashboard/s' },
  { label: 'Customers', href: '/dashboard/s/customers' },
  { label: 'Staff', href: '/dashboard/s/staff' },
  { label: 'Settings', href: '/dashboard/s/settings' },
];

function renderMenu(onAbout = () => {}, currentPath = '/dashboard/s/settings') {
  return render(
    <MemoryRouter>
      <NavMenu tabs={tabs} currentPath={currentPath} onAbout={onAbout} />
    </MemoryRouter>,
  );
}

describe('NavMenu', () => {
  it('is closed until the hamburger is clicked', async () => {
    renderMenu();

    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('lists every view and marks the current one', async () => {
    renderMenu(() => {}, '/dashboard/s/staff');
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = within(screen.getByRole('menu'));

    for (const tab of tabs) {
      expect(menu.getByRole('menuitem', { name: tab.label })).toBeTruthy();
    }
    expect(menu.getByRole('menuitem', { name: 'Staff' })).toHaveAttribute('aria-current', 'page');
    expect(menu.getByRole('menuitem', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });

  it('calls onAbout and closes when About is picked', async () => {
    const onAbout = vi.fn();
    renderMenu(onAbout);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    await userEvent.click(screen.getByRole('menuitem', { name: 'About' }));

    expect(onAbout).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
