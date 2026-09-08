import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthShell } from './AuthShell';

function renderShell(ui: Parameters<typeof render>[0]) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AuthShell', () => {
  it('renders the heading, optional subheading, children, footer, and legal links', () => {
    renderShell(
      <AuthShell heading="Sign in" subheading="Welcome back" footer={<span>footer link</span>}>
        <form>the form</form>
      </AuthShell>,
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('the form')).toBeTruthy();
    expect(screen.getByText('footer link')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });

  it('has a close control back to the landing page', () => {
    renderShell(
      <AuthShell heading="Sign in">
        <form>x</form>
      </AuthShell>,
    );

    expect(screen.getByRole('link', { name: /close/i })).toHaveAttribute('href', '/');
  });
});
