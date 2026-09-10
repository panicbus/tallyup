import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalPage } from './LegalPage';
import { getMe } from '../lib/api';

vi.mock('../lib/api', () => ({ getMe: vi.fn() }));
const getMeMock = vi.mocked(getMe);

function renderPage() {
  return render(
    <MemoryRouter>
      <LegalPage title="Privacy Policy" updated="September 2026">
        <p>body text</p>
      </LegalPage>
    </MemoryRouter>,
  );
}

describe('LegalPage', () => {
  it('renders the title, the last-updated line, a back link, and the body', () => {
    getMeMock.mockResolvedValue(null);
    renderPage();

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeTruthy();
    expect(screen.getByText('Last updated September 2026')).toBeTruthy();
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/');
    expect(screen.getByText('body text')).toBeTruthy();
  });

  it('points the back link at the landing page for a visitor', async () => {
    getMeMock.mockResolvedValue(null);
    renderPage();

    // Nothing to wait for, but confirm it never flips away from "/".
    await Promise.resolve();
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/');
  });

  it('points the back link at the dashboard for a signed-in user', async () => {
    getMeMock.mockResolvedValue({
      id: 's1',
      email: 'owner@example.com',
      name: null,
      role: 'owner',
      business: {
        id: 'b1',
        name: 'My Shop',
        slug: 'my-shop',
        rewardThreshold: 10,
        rewardDescription: 'a coffee',
        logoUrl: null,
      },
    });
    renderPage();

    const link = screen.getByRole('link', { name: /back/i });
    await waitFor(() => expect(link).toHaveAttribute('href', '/dashboard/my-shop'));
  });
});
