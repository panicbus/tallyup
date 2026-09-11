import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('starts in light mode by default and applies it to the document', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('picks up an already-stored dark preference', () => {
    localStorage.setItem('tallyup:theme', 'dark');

    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles to dark, applies it, and remembers it for next time', async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }));

    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('tallyup:theme')).toBe('dark');
  });

  it('toggles back to light on a second click', async () => {
    localStorage.setItem('tallyup:theme', 'dark');
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button', { name: /switch to light mode/i }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('tallyup:theme')).toBe('light');
  });
});
