import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingForm } from './OnboardingForm';

// LogoPicker uploads on selection; stub the storage round trip so these
// tests stay about the form, not Supabase.
vi.mock('../lib/logo-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/logo-upload')>()),
  uploadLogo: vi.fn(async () => ({
    outcome: 'uploaded' as const,
    url: 'https://test-project.supabase.co/storage/v1/object/public/business-logos/u/logo.png',
  })),
}));

describe('OnboardingForm', () => {
  it('auto-derives the slug from the business name', async () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/business name/i), 'Demo Bookstore');

    expect(screen.getByLabelText(/check-in url/i)).toHaveValue('demo-bookstore');
  });

  it('lets the slug be edited directly, independent of further name edits', async () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/business name/i), 'Demo Bookstore');
    const slugField = screen.getByLabelText(/check-in url/i);
    await userEvent.clear(slugField);
    await userEvent.type(slugField, 'my-custom-url');
    await userEvent.type(screen.getByLabelText(/business name/i), ' Two');

    expect(slugField).toHaveValue('my-custom-url');
  });

  it('submits the entered values', async () => {
    const onSubmit = vi.fn();
    render(<OnboardingForm onSubmit={onSubmit} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/business name/i), 'Demo Bookstore');
    await userEvent.clear(screen.getByLabelText(/punches needed/i));
    await userEvent.type(screen.getByLabelText(/punches needed/i), '8');
    await userEvent.type(screen.getByLabelText(/reward, in your words/i), 'A free used book');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Demo Bookstore',
      slug: 'demo-bookstore',
      rewardThreshold: 8,
      rewardDescription: 'A free used book',
      logoUrl: null,
    });
  });

  it('disables the button while submitting', () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={true} />);

    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('shows a general error message when given one', () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={false} error="This account is already linked to a business." />);

    expect(screen.getByRole('alert')).toHaveTextContent('already linked');
  });

  it('shows a slug-specific error under the check-in URL field, replacing the normal hint', () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={false} slugError="That URL is already taken. Pick another." />);

    expect(screen.getByText('That URL is already taken. Pick another.')).toBeTruthy();
    expect(screen.queryByText(/can't change later/i)).toBeNull();
  });

  it('lets a logo image be selected and shows a preview', async () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={false} />);
    const file = new File(['fake-image-bytes'], 'logo.png', { type: 'image/png' });

    const input = screen.getByLabelText(/business logo/i) as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(input.files?.[0]).toBe(file);
    expect(screen.getByAltText(/logo preview/i)).toBeTruthy();
  });
});
