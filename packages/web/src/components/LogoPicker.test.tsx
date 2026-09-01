import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoPicker } from './LogoPicker';

describe('LogoPicker', () => {
  it('shows a placeholder icon before any file is selected', () => {
    render(<LogoPicker />);

    expect(screen.queryByAltText(/logo preview/i)).toBeNull();
  });

  it('lets an image be selected and shows a preview', async () => {
    render(<LogoPicker />);
    const file = new File(['fake-image-bytes'], 'logo.png', { type: 'image/png' });

    const input = screen.getByLabelText(/business logo/i) as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(input.files?.[0]).toBe(file);
    expect(screen.getByAltText(/logo preview/i)).toBeTruthy();
  });

  it('does not offer a remove option before a file is selected', () => {
    render(<LogoPicker />);

    expect(screen.queryByRole('button', { name: /remove logo/i })).toBeNull();
  });

  it('lets a selected logo be removed, reverting to the placeholder', async () => {
    render(<LogoPicker />);
    const file = new File(['fake-image-bytes'], 'logo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/business logo/i) as HTMLInputElement;
    await userEvent.upload(input, file);

    await userEvent.click(screen.getByRole('button', { name: /remove logo/i }));

    expect(screen.queryByAltText(/logo preview/i)).toBeNull();
    expect(input.value).toBe('');
  });
});
