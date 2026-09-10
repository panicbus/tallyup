import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AboutModal } from './AboutModal';

function renderModal(onClose = () => {}) {
  return render(
    <MemoryRouter>
      <AboutModal onClose={onClose} />
    </MemoryRouter>,
  );
}

describe('AboutModal', () => {
  it('describes the app and how the punch card works', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'About TallyUp' })).toBeTruthy();
    expect(screen.getByText(/digital loyalty punch card/i)).toBeTruthy();
    expect(screen.getByText(/scans your shop's QR code/i)).toBeTruthy();
  });

  it('credits the author and links to Ko-fi, Terms, and Privacy', () => {
    renderModal();

    expect(screen.getByText(/Created by Nico Crisafulli with Claude Code in Alameda, CA/)).toBeTruthy();
    expect(screen.getByText('© 2026 TallyUp')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Buy me a coffee' })).toHaveAttribute(
      'href',
      'https://ko-fi.com/nicocrisafulli',
    );
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });

  it('closes on the close button, the overlay, and Escape', async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
