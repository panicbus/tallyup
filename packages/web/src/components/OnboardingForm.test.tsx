import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingForm } from './OnboardingForm';

describe('OnboardingForm', () => {
  it('auto-derives the slug from the business name', async () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/business name/i), 'Demo Bookstore');

    expect(screen.getByLabelText(/url/i)).toHaveValue('demo-bookstore');
  });

  it('lets the slug be edited directly, independent of further name edits', async () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={false} />);

    await userEvent.type(screen.getByLabelText(/business name/i), 'Demo Bookstore');
    const slugField = screen.getByLabelText(/url/i);
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
    await userEvent.type(screen.getByLabelText(/reward/i), 'A free used book');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Demo Bookstore',
      slug: 'demo-bookstore',
      rewardThreshold: 8,
      rewardDescription: 'A free used book',
    });
  });

  it('disables the button while submitting', () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={true} />);

    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('shows an error message when given one', () => {
    render(<OnboardingForm onSubmit={() => {}} submitting={false} error="That URL is already taken." />);

    expect(screen.getByRole('alert')).toHaveTextContent('That URL is already taken.');
  });
});
