import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the app shell heading', async () => {
    render(<App />);
    // The landing page checks for a session on mount before it decides
    // whether to redirect, so the heading arrives on the next tick.
    expect(await screen.findByRole('heading', { name: 'TallyUp' })).toBeTruthy();
  });
});
