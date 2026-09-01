import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoPicker } from './LogoPicker';
import { uploadLogo } from '../lib/logo-upload';

vi.mock('../lib/logo-upload', () => ({ uploadLogo: vi.fn() }));

const uploadLogoMock = vi.mocked(uploadLogo);

const UPLOADED_URL = 'https://test-project.supabase.co/storage/v1/object/public/business-logos/u/logo.png';

function pngFile() {
  return new File(['fake-image-bytes'], 'logo.png', { type: 'image/png' });
}

describe('LogoPicker', () => {
  beforeEach(() => {
    uploadLogoMock.mockReset();
    uploadLogoMock.mockResolvedValue({ outcome: 'uploaded', url: UPLOADED_URL });
  });

  it('shows a placeholder icon before any file is selected', () => {
    render(<LogoPicker />);

    expect(screen.queryByAltText(/logo preview/i)).toBeNull();
  });

  it('lets an image be selected and shows a preview', async () => {
    render(<LogoPicker />);
    const file = pngFile();

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
    const input = screen.getByLabelText(/business logo/i) as HTMLInputElement;
    await userEvent.upload(input, pngFile());

    await userEvent.click(screen.getByRole('button', { name: /remove logo/i }));

    expect(screen.queryByAltText(/logo preview/i)).toBeNull();
    expect(input.value).toBe('');
  });

  it('renders an existing logo passed in as value', () => {
    render(<LogoPicker value={UPLOADED_URL} />);

    expect(screen.getByAltText(/logo preview/i)).toHaveAttribute('src', UPLOADED_URL);
  });

  it('uploads on selection and reports the stored URL', async () => {
    const onChange = vi.fn();
    render(<LogoPicker onChange={onChange} />);

    await userEvent.upload(screen.getByLabelText(/business logo/i), pngFile());

    expect(uploadLogoMock).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(UPLOADED_URL);
  });

  it('surfaces an upload failure and does not report a URL', async () => {
    const onChange = vi.fn();
    uploadLogoMock.mockResolvedValue({ outcome: 'failed', reason: 'That image is over 2MB. Try a smaller one.' });
    render(<LogoPicker onChange={onChange} />);

    await userEvent.upload(screen.getByLabelText(/business logo/i), pngFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(/over 2mb/i);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports null when a logo is removed', async () => {
    const onChange = vi.fn();
    render(<LogoPicker value={UPLOADED_URL} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /remove logo/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
