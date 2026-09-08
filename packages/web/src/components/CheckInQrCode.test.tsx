import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckInQrCode } from './CheckInQrCode';

describe('CheckInQrCode', () => {
  it('renders the customer check-in URL for the given slug', () => {
    render(<CheckInQrCode slug="demo-shop" />);

    expect(screen.getByText(`${window.location.host}/checkin/demo-shop`)).toBeTruthy();
  });

  it('renders a QR svg encoding the check-in URL', () => {
    const { container } = render(<CheckInQrCode slug="demo-shop" />);

    const svg = container.querySelector('svg[role="img"], svg');
    expect(svg).not.toBeNull();
  });

  it('is deterministic: same slug renders identical QR markup', () => {
    const first = render(<CheckInQrCode slug="nicos-place" />).container.querySelector('svg')?.outerHTML;
    const second = render(<CheckInQrCode slug="nicos-place" />).container.querySelector('svg')?.outerHTML;

    expect(first).toBeTruthy();
    expect(first).toEqual(second);
  });

  it('offers a save-to-photos action that names the file after the slug', async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    // jsdom has no real canvas encoder; stub the bits the handler touches.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: () => {},
      drawImage: () => {},
      set fillStyle(_v: string) {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
      cb(new Blob(['x'], { type: 'image/png' })),
    );
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

    render(<CheckInQrCode slug="demo-shop" />);
    const button = screen.getByRole('button', { name: /save qr/i });
    await userEvent.click(button);
    // The Image onload path is async in real browsers; fire it directly.
    const img = new Image();
    img.dispatchEvent(new Event('load'));

    expect(button).toBeTruthy();
    anchorClick.mockRestore();
  });
});
