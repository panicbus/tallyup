import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from './SettingsForm';

const business = {
  name: 'Demo Bookstore',
  slug: 'demo-bookstore',
  rewardThreshold: 10,
  rewardDescription: 'A free used book',
};

describe('SettingsForm', () => {
  it('pre-fills fields from the current business', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} />);

    expect(screen.getByLabelText(/business name/i)).toHaveValue('Demo Bookstore');
    expect(screen.getByLabelText(/punches needed/i)).toHaveValue(10);
    expect(screen.getByLabelText(/reward description/i)).toHaveValue('A free used book');
  });

  it('shows the check-in URL as read-only, not an editable field', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} />);

    expect(screen.getByText('demo-bookstore')).toBeTruthy();
    expect(screen.queryByLabelText(/url/i)).toBeNull();
  });

  it('warns that lowering the threshold makes customers instantly eligible', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} />);

    expect(screen.getByText(/instantly eligible/i)).toBeTruthy();
  });

  it('submits the edited values', async () => {
    const onSubmit = vi.fn();
    render(<SettingsForm business={business} onSubmit={onSubmit} submitting={false} />);

    const thresholdField = screen.getByLabelText(/punches needed/i);
    await userEvent.clear(thresholdField);
    await userEvent.type(thresholdField, '5');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Demo Bookstore',
      rewardThreshold: 5,
      rewardDescription: 'A free used book',
    });
  });

  it('disables the button while submitting', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={true} />);

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('shows an error message when given one', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} error="Something went wrong." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });
});
