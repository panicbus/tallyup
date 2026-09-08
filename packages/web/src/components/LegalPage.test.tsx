import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalPage } from './LegalPage';

describe('LegalPage', () => {
  it('renders the title, the last-updated line, a back link, and the body', () => {
    render(
      <MemoryRouter>
        <LegalPage title="Privacy Policy" updated="September 2026">
          <p>body text</p>
        </LegalPage>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeTruthy();
    expect(screen.getByText('Last updated September 2026')).toBeTruthy();
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/');
    expect(screen.getByText('body text')).toBeTruthy();
  });
});
